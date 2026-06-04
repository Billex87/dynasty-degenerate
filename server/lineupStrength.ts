import type {
  LineupStrengthManagerRead,
  LineupStrengthSummary,
  ManagerStarterPlayer,
  MatchupPreview,
  PlayerScheduleProfile,
  ReportData,
  WeeklyProjectionContext,
} from "../shared/types";

type ManagerPositionRow = ReportData["managerPositionCounts"][number];

const PROJECTION_POINT_SCORE_MULTIPLIER = 4;
const BENCH_ALTERNATIVE_LIMIT = 3;

function round(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function getPlayerValue(player: ManagerStarterPlayer): number {
  const value = player.seasonValue ?? player.value ?? player.playerDetails?.valueProfile?.seasonValue ?? player.playerDetails?.valueProfile?.dynastyValue ?? 0;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getProjection(
  player: ManagerStarterPlayer,
  playerDetailsById: ReportData["playerDetailsById"],
  projectionReady: boolean
): WeeklyProjectionContext | null {
  if (!projectionReady) return null;
  const projection = player.weeklyProjection || playerDetailsById?.[player.player_id]?.weeklyProjection || null;
  return projection?.status === "ready" ? projection : null;
}

function getScheduleProfile(
  player: ManagerStarterPlayer,
  playerDetailsById: ReportData["playerDetailsById"]
): PlayerScheduleProfile | null {
  return player.playerDetails?.schedule || playerDetailsById?.[player.player_id]?.schedule || null;
}

function getSchedulePlayerScore(profile: PlayerScheduleProfile | null): number | null {
  if (!profile) return null;
  if (profile.scheduleTier === "elite") return 12;
  if (profile.scheduleTier === "easy") return 8;
  if (profile.scheduleTier === "hard") return -8;
  return 0;
}

function getPlayerCompositeScore(input: {
  player: ManagerStarterPlayer;
  playerDetailsById: ReportData["playerDetailsById"];
  projectionReady: boolean;
}): {
  value: number;
  projectionPoints: number | null;
  projectionScore: number;
  scheduleScore: number | null;
  totalScore: number;
} {
  const value = getPlayerValue(input.player);
  const projection = getProjection(input.player, input.playerDetailsById, input.projectionReady);
  const projectionPoints = projection?.projectedFantasyPoints ?? null;
  const projectionScore = projectionPoints === null ? 0 : projectionPoints * PROJECTION_POINT_SCORE_MULTIPLIER;
  const scheduleScore = getSchedulePlayerScore(getScheduleProfile(input.player, input.playerDetailsById));
  const totalScore = value / 100 + projectionScore + (scheduleScore ?? 0);
  return {
    value,
    projectionPoints,
    projectionScore,
    scheduleScore,
    totalScore,
  };
}

function getManagerPlayers(row: ManagerPositionRow): {
  starters: ManagerStarterPlayer[];
  lineupPool: ManagerStarterPlayer[];
} {
  const starters = row.starterPlayers?.length ? row.starterPlayers : [];
  const starterKeys = new Set(starters.map(player => player.player_id).filter(Boolean));
  const lineupPool = (row.lineupPlayers?.length ? row.lineupPlayers : row.rosterPlayers || [])
    .filter(player => player?.player_id);

  return {
    starters,
    lineupPool: lineupPool.filter(player => !starterKeys.has(player.player_id)),
  };
}

function getPositionGroup(position?: string | null): string {
  const normalized = String(position || "").toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized || "UNK";
}

function classifyBenchAlternative(input: {
  scoreDelta: number;
  projectionDelta: number | null;
  projectionReady: boolean;
}): Pick<LineupStrengthManagerRead["benchAlternatives"][number], "decision" | "confidence" | "closeCallReason"> {
  if (input.scoreDelta <= 0) {
    return {
      decision: "hold",
      confidence: Math.max(48, Math.min(66, Math.round(58 + Math.abs(input.scoreDelta)))),
      closeCallReason: null,
    };
  }

  if (!input.projectionReady || input.projectionDelta === null) {
    return {
      decision: input.scoreDelta >= 10 ? "upgrade" : "close-call",
      confidence: input.scoreDelta >= 10 ? 66 : 56,
      closeCallReason: input.scoreDelta >= 10
        ? null
        : "Projection edge is unavailable, so the positive value/SOS score stays review-only.",
    };
  }

  if (input.projectionDelta >= 2.5 && input.scoreDelta >= 8) {
    return {
      decision: "upgrade",
      confidence: Math.min(84, Math.round(68 + input.projectionDelta * 3 + Math.min(8, input.scoreDelta / 2))),
      closeCallReason: null,
    };
  }

  if (Math.abs(input.projectionDelta) < 2 || input.scoreDelta < 8) {
    return {
      decision: "close-call",
      confidence: Math.max(54, Math.min(64, Math.round(56 + input.scoreDelta / 2))),
      closeCallReason: "Projection edge is under two points or the composite score edge is thin.",
    };
  }

  return {
    decision: "hold",
    confidence: 58,
    closeCallReason: null,
  };
}

function buildBenchAlternatives(input: {
  starters: ManagerStarterPlayer[];
  lineupPool: ManagerStarterPlayer[];
  playerDetailsById: ReportData["playerDetailsById"];
  projectionReady: boolean;
}): LineupStrengthManagerRead["benchAlternatives"] {
  const alternatives = input.starters.flatMap(starter => {
    const starterScore = getPlayerCompositeScore({
      player: starter,
      playerDetailsById: input.playerDetailsById,
      projectionReady: input.projectionReady,
    });
    const starterPosition = getPositionGroup(starter.pos);
    return input.lineupPool
      .filter(candidate => getPositionGroup(candidate.pos) === starterPosition)
      .map(candidate => {
        const candidateScore = getPlayerCompositeScore({
          player: candidate,
          playerDetailsById: input.playerDetailsById,
          projectionReady: input.projectionReady,
        });
        const projectionDelta =
          candidateScore.projectionPoints === null || starterScore.projectionPoints === null
            ? null
            : round(candidateScore.projectionPoints - starterScore.projectionPoints);
        const valueDelta = Math.round(candidateScore.value - starterScore.value);
        const scoreDelta = round(candidateScore.totalScore - starterScore.totalScore);
        const decision = classifyBenchAlternative({
          scoreDelta,
          projectionDelta,
          projectionReady: input.projectionReady,
        });
        return {
          starter,
          alternative: candidate,
          scoreDelta,
          projectionDelta,
          valueDelta,
          ...decision,
          note: scoreDelta > 0
            ? `${candidate.name} grades ${scoreDelta} points ahead of ${starter.name}.`
            : `${candidate.name} is ${Math.abs(scoreDelta)} points behind ${starter.name}.`,
        };
      });
  });

  return alternatives
    .filter(row => row.scoreDelta > -8)
    .sort((a, b) => b.scoreDelta - a.scoreDelta || b.valueDelta - a.valueDelta)
    .slice(0, BENCH_ALTERNATIVE_LIMIT);
}

function getTopAndWeakestStarter(input: {
  starters: ManagerStarterPlayer[];
  playerDetailsById: ReportData["playerDetailsById"];
  projectionReady: boolean;
}): {
  topStarter: ManagerStarterPlayer | null;
  weakestStarter: ManagerStarterPlayer | null;
} {
  const scored = input.starters
    .map(player => ({
      player,
      score: getPlayerCompositeScore({
        player,
        playerDetailsById: input.playerDetailsById,
        projectionReady: input.projectionReady,
      }).totalScore,
    }))
    .sort((a, b) => b.score - a.score);
  return {
    topStarter: scored[0]?.player || null,
    weakestStarter: scored.at(-1)?.player || null,
  };
}

function getProjectionStatus(reportData: ReportData): LineupStrengthSummary["projectionStatus"] {
  return reportData.weeklyProjectionDiagnostics?.status || "missing";
}

function getScheduleStatus(reportData: ReportData): LineupStrengthSummary["scheduleStatus"] {
  const rows = reportData.managerPositionCounts || [];
  let playerCount = 0;
  let scheduledCount = 0;
  for (const row of rows) {
    for (const player of row.starterPlayers || []) {
      playerCount += 1;
      if (getScheduleProfile(player, reportData.playerDetailsById)) scheduledCount += 1;
    }
  }
  if (!playerCount || !scheduledCount) return "missing";
  return scheduledCount === playerCount ? "ready" : "partial";
}

function getMatchupByManager(matchupPreviews: MatchupPreview[] | undefined): Map<string, MatchupPreview> {
  return new Map((matchupPreviews || []).map(preview => [preview.manager, preview]));
}

function buildPositionEdges(input: {
  row: ManagerPositionRow;
  opponentRow: ManagerPositionRow | null;
  managerScoresByPlayerId: Map<string, number>;
  opponentScoresByPlayerId: Map<string, number>;
}): LineupStrengthManagerRead["positionEdges"] {
  const positions = Array.from(new Set([
    ...(input.row.starterGroups || []).map(group => group.key),
    ...((input.opponentRow?.starterGroups || []).map(group => group.key)),
  ]));

  return positions.map(position => {
    const managerPlayers = (input.row.starterGroups || []).find(group => group.key === position)?.players || [];
    const opponentPlayers = (input.opponentRow?.starterGroups || []).find(group => group.key === position)?.players || [];
    const managerScore = round(managerPlayers.reduce((sum, player) => sum + (input.managerScoresByPlayerId.get(player.player_id) || 0), 0));
    const opponentScore = input.opponentRow
      ? round(opponentPlayers.reduce((sum, player) => sum + (input.opponentScoresByPlayerId.get(player.player_id) || 0), 0))
      : null;
    const edge = opponentScore === null ? null : round(managerScore - opponentScore);
    return {
      position,
      managerScore,
      opponentScore,
      edge,
      note: edge === null
        ? `${position} opponent edge unavailable without matchup opponent.`
        : edge >= 0
          ? `${position} grades ${edge} points ahead.`
          : `${position} trails by ${Math.abs(edge)} points.`,
    };
  });
}

function buildProjectionRange(input: {
  projectionPoints: number | null;
  starterCount: number;
  scheduleScore: number | null;
  fullProjectionCoverage: boolean;
}): LineupStrengthManagerRead["projectionRange"] {
  if (!input.fullProjectionCoverage || input.projectionPoints === null || input.starterCount <= 0) return null;
  const halfSpread = Math.max(5, Math.sqrt(input.starterCount) * 4 + (input.scheduleScore === null ? 1.5 : 0));
  const floorPoints = round(Math.max(0, input.projectionPoints - halfSpread));
  const ceilingPoints = round(input.projectionPoints + halfSpread);
  const confidence = input.scheduleScore === null ? 64 : 72;
  return {
    floorPoints,
    ceilingPoints,
    spread: round(ceilingPoints - floorPoints),
    confidence,
    source: "derived-weekly-projection",
    note: input.scheduleScore === null
      ? "Derived from full stored weekly projection coverage; SOS context is missing, so the range is confidence-capped."
      : "Derived from full stored weekly projection coverage plus available schedule context. This is not a provider-supplied percentile range.",
  };
}

function getWinProbabilityConfidenceLabel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 78) return "high";
  if (confidence >= 64) return "medium";
  return "low";
}

function buildProjectedWinProbability(input: {
  projectionPoints: number | null;
  opponentProjectionPoints: number | null;
  fullProjectionCoverage: boolean;
  opponentFullProjectionCoverage: boolean;
  scheduleScore: number | null;
  opponentManager: string | null;
}): LineupStrengthManagerRead["projectedWinProbability"] {
  if (
    !input.opponentManager ||
    !input.fullProjectionCoverage ||
    !input.opponentFullProjectionCoverage ||
    input.projectionPoints === null ||
    input.opponentProjectionPoints === null
  ) {
    return null;
  }
  const projectionPointEdge = round(input.projectionPoints - input.opponentProjectionPoints);
  const probability = round(100 / (1 + Math.exp(-projectionPointEdge / 10)));
  const confidence = Math.min(86, Math.max(58, Math.round(68 + Math.min(12, Math.abs(projectionPointEdge)) + (input.scheduleScore === null ? -8 : 0))));
  return {
    probability,
    projectionPointEdge,
    confidence,
    confidenceLabel: getWinProbabilityConfidenceLabel(confidence),
    source: "derived-weekly-projection",
    note: input.scheduleScore === null
      ? `Projected win probability is derived from full stored projection coverage against ${input.opponentManager}, but schedule context is missing.`
      : `Projected win probability is derived from full stored projection coverage against ${input.opponentManager}.`,
  };
}

export function buildLineupStrength(reportData: ReportData, options: { generatedAt?: string } = {}): LineupStrengthSummary {
  const projectionReady = reportData.weeklyProjectionDiagnostics?.status === "ready" &&
    Number(reportData.weeklyProjectionDiagnostics.attachedPlayerCount || 0) > 0;
  const projectionStatus = getProjectionStatus(reportData);
  const scheduleStatus = getScheduleStatus(reportData);
  const matchupByManager = getMatchupByManager(reportData.matchupPreviews);
  const rowsByManager = new Map((reportData.managerPositionCounts || []).map(row => [row.manager, row]));
  const scoreMapsByManager = new Map<string, Map<string, number>>();
  const totalScoreByManager = new Map<string, number>();
  const projectionPointsByManager = new Map<string, number | null>();
  const fullProjectionCoverageByManager = new Map<string, boolean>();

  for (const row of reportData.managerPositionCounts || []) {
    const { starters } = getManagerPlayers(row);
    const scoreMap = new Map<string, number>();
    let total = 0;
    let projectionPointTotal = 0;
    let projectionCount = 0;
    for (const player of starters) {
      const compositeScore = getPlayerCompositeScore({
        player,
        playerDetailsById: reportData.playerDetailsById,
        projectionReady,
      });
      const score = compositeScore.totalScore;
      scoreMap.set(player.player_id, score);
      total += score;
      if (compositeScore.projectionPoints !== null) {
        projectionPointTotal += compositeScore.projectionPoints;
        projectionCount += 1;
      }
    }
    scoreMapsByManager.set(row.manager, scoreMap);
    totalScoreByManager.set(row.manager, round(total));
    projectionPointsByManager.set(row.manager, projectionReady && projectionCount > 0 ? round(projectionPointTotal) : null);
    fullProjectionCoverageByManager.set(row.manager, projectionReady && starters.length > 0 && projectionCount === starters.length);
  }

  const rows = (reportData.managerPositionCounts || []).map((row): LineupStrengthManagerRead => {
    const { starters, lineupPool } = getManagerPlayers(row);
    const matchup = matchupByManager.get(row.manager) || null;
    const opponentManager = matchup?.opponentManager || null;
    const opponentRow = opponentManager ? rowsByManager.get(opponentManager) || null : null;
    const playerScores = starters.map(player => getPlayerCompositeScore({
      player,
      playerDetailsById: reportData.playerDetailsById,
      projectionReady,
    }));
    const valueScore = round(playerScores.reduce((sum, score) => sum + score.value, 0) / 100);
    const projectionPoints = projectionReady
      ? round(playerScores.reduce((sum, score) => sum + (score.projectionPoints || 0), 0))
      : null;
    const fullProjectionCoverage = Boolean(fullProjectionCoverageByManager.get(row.manager));
    const projectionScore = round(playerScores.reduce((sum, score) => sum + score.projectionScore, 0));
    const scheduleScores = playerScores
      .map(score => score.scheduleScore)
      .filter((score): score is number => score !== null);
    const scheduleScore = scheduleScores.length
      ? round(scheduleScores.reduce((sum, score) => sum + score, 0))
      : null;
    const totalScore = totalScoreByManager.get(row.manager) || 0;
    const opponentTotalScore = opponentManager ? totalScoreByManager.get(opponentManager) ?? null : null;
    const opponentProjectionPoints = opponentManager ? projectionPointsByManager.get(opponentManager) ?? null : null;
    const opponentFullProjectionCoverage = opponentManager ? Boolean(fullProjectionCoverageByManager.get(opponentManager)) : false;
    const edge = opponentTotalScore === null ? null : round(totalScore - opponentTotalScore);
    const confidence = Math.min(
      92,
      Math.round(
        48 +
        (row.starterSource === "Sleeper" ? 8 : 4) +
        (projectionReady ? 18 : 0) +
        (scheduleScore !== null ? 8 : 0) +
        (opponentManager ? 8 : 0)
      )
    );
    const confidenceCapReason = !projectionReady
      ? "Weekly projection readiness failed, so lineup strength is value/rank first."
      : scheduleScore === null
        ? "Schedule context is missing for these starters, so SOS does not affect the score."
        : null;
    const { topStarter, weakestStarter } = getTopAndWeakestStarter({
      starters,
      playerDetailsById: reportData.playerDetailsById,
      projectionReady,
    });
    const status: LineupStrengthManagerRead["status"] = projectionReady
      ? scheduleScore === null ? "partial" : "ready"
      : "value-only";

    return {
      manager: row.manager,
      opponentManager,
      status,
      starterSource: row.starterSource,
      starterCount: starters.length,
      valueScore,
      projectionPoints,
      projectionScore,
      projectionRange: buildProjectionRange({
        projectionPoints,
        starterCount: starters.length,
        scheduleScore,
        fullProjectionCoverage,
      }),
      scheduleScore,
      totalScore,
      opponentTotalScore,
      edge,
      projectedWinProbability: buildProjectedWinProbability({
        projectionPoints,
        opponentProjectionPoints,
        fullProjectionCoverage,
        opponentFullProjectionCoverage,
        scheduleScore,
        opponentManager,
      }),
      confidence,
      confidenceCapReason,
      summary: edge === null
        ? `${row.manager} lineup strength is ${totalScore}. Opponent edge is unavailable without a current matchup.`
        : edge >= 0
          ? `${row.manager} has a ${edge}-point lineup-strength edge over ${opponentManager}.`
          : `${row.manager} trails ${opponentManager} by ${Math.abs(edge)} lineup-strength points.`,
      topStarter,
      weakestStarter,
      benchAlternatives: buildBenchAlternatives({
        starters,
        lineupPool,
        playerDetailsById: reportData.playerDetailsById,
        projectionReady,
      }),
      positionEdges: buildPositionEdges({
        row,
        opponentRow,
        managerScoresByPlayerId: scoreMapsByManager.get(row.manager) || new Map(),
        opponentScoresByPlayerId: opponentManager ? scoreMapsByManager.get(opponentManager) || new Map() : new Map(),
      }),
    };
  });

  const status: LineupStrengthSummary["status"] = projectionReady
    ? scheduleStatus === "missing" ? "partial" : "ready"
    : "value-only";

  return {
    status,
    source: "stored-report-lineup",
    projectionStatus,
    scheduleStatus,
    generatedAt: options.generatedAt || new Date().toISOString(),
    rows,
    note: projectionReady
      ? "Lineup strength uses submitted/projected starters plus stored weekly projections when attached; schedule context is included only where snapshot-backed rows are available."
      : "Lineup strength is using value/rank fallback because stored weekly projections are not ready.",
  };
}
