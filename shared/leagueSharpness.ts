import type { ReportData } from "./types";

export type LeagueSharpnessTier =
  | "sleepy"
  | "casual"
  | "average"
  | "sharp"
  | "shark-tank";

export type LeagueSharpnessSignalStatus = "thin" | "building" | "strong";

export type LeagueSharpnessSignal = {
  key: string;
  label: string;
  score: number;
  weight: number;
  status: LeagueSharpnessSignalStatus;
  note: string;
};

export type LeagueSharpnessProfile = {
  score: number;
  tier: LeagueSharpnessTier;
  label: string;
  actionBias: "wait" | "snipe" | "balanced" | "attack" | "overpay-or-pass";
  confidence: "thin" | "building" | "usable";
  note: string;
  sampleSize: number;
  teamCount: number;
  inactiveManagerCount: number;
  tradeSignalsPerTeam: number;
  waiverSignalsPerTeam: number;
  transactionSignalsPerTeam: number;
  signals: LeagueSharpnessSignal[];
};

type LeagueSharpnessInput = Partial<Pick<
  ReportData,
  | "leagueDiagnostics"
  | "tradeHistory"
  | "tradeTendencies"
  | "tradeProposalSignals"
  | "adminTradeProposalSignals"
  | "adminSleeperTradeProposalSignals"
  | "adminSleeperWaiverSignals"
  | "sleeperHiddenLeagueSnapshot"
  | "transactionBackfillDiagnostics"
  | "recentTransactions"
  | "waiverIntelligence"
  | "managerRosterIntelligence"
  | "managerPositionCounts"
  | "powerRankings"
  | "managerRosterValueGrowth"
  | "draftStats"
  | "rankings"
  | "playerDetailsById"
>>;

function safeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function positiveNumber(value: unknown): number {
  const numeric = safeNumber(value);
  return numeric > 0 ? numeric : 0;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  const usable = values.filter(value => Number.isFinite(value));
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function scorePerTeam(value: number, target: number): number {
  if (!target) return value ? 100 : 0;
  return clampPercent((value / target) * 100);
}

function getTeamCount(input: LeagueSharpnessInput): number {
  return Math.max(
    1,
    positiveNumber(input.leagueDiagnostics?.teamCount) ||
      input.managerRosterIntelligence?.length ||
      input.leagueDiagnostics?.rosterSlots?.length ||
      12
  );
}

function maxPerSeason(total: number, seasonCount?: number | null): number {
  const seasons = Math.max(1, Math.round(positiveNumber(seasonCount) || 1));
  return total / seasons;
}

function getActivitySignals(input: LeagueSharpnessInput, teamCount: number) {
  const backfill = input.transactionBackfillDiagnostics;
  const backfillSeasons = positiveNumber(backfill?.seasonCount) || 1;
  const completedTradesPerSeason = maxPerSeason(
    positiveNumber(backfill?.completedTradeCount),
    backfillSeasons
  );
  const waiverMovesPerSeason = maxPerSeason(
    positiveNumber(backfill?.waiverOrFreeAgentCount),
    backfillSeasons
  );
  const transactionsPerSeason = maxPerSeason(
    positiveNumber(backfill?.transactionCount),
    backfillSeasons
  );
  const currentTradeSignals = Math.max(
    positiveNumber(input.tradeHistory?.length),
    positiveNumber(input.sleeperHiddenLeagueSnapshot?.tradeCount),
    completedTradesPerSeason
  );
  const proposalSignals = Math.max(
    positiveNumber(input.tradeProposalSignals?.length),
    positiveNumber(input.adminTradeProposalSignals?.length),
    positiveNumber(input.adminSleeperTradeProposalSignals?.length)
  );
  const managerTradeSignals = Math.max(
    positiveNumber(input.tradeTendencies?.length),
    positiveNumber(input.tradeTendencies?.reduce((sum, row) => sum + positiveNumber(row.tradeCount), 0))
  );
  const recentTransactions = positiveNumber(input.recentTransactions?.length);
  const waiverPoolSignals = Math.max(
    positiveNumber(input.waiverIntelligence?.availableTrendingAdds?.length),
    positiveNumber(input.waiverIntelligence?.weeklyEcrTargets?.length),
    positiveNumber(input.adminSleeperWaiverSignals?.length)
  );
  const waiverSignals = Math.max(
    recentTransactions,
    positiveNumber(input.sleeperHiddenLeagueSnapshot?.waiverCount),
    waiverMovesPerSeason,
    waiverPoolSignals
  );
  const transactionSignals = Math.max(
    recentTransactions,
    positiveNumber(input.sleeperHiddenLeagueSnapshot?.transactionCount),
    transactionsPerSeason
  );
  const tradeSignals = currentTradeSignals + proposalSignals * 0.5 + managerTradeSignals * 0.25;

  return {
    tradeSignals,
    waiverSignals,
    transactionSignals,
    tradeSignalsPerTeam: tradeSignals / teamCount,
    waiverSignalsPerTeam: waiverSignals / teamCount,
    transactionSignalsPerTeam: transactionSignals / teamCount,
    sampleSize: Math.round(tradeSignals + waiverSignals + transactionSignals),
  };
}

function getRosterQualityScore(input: LeagueSharpnessInput): number | null {
  const powerScores = average(
    (input.powerRankings || []).map(row =>
      average([
        safeNumber(row.score),
        safeNumber(row.starterStrength),
        safeNumber(row.positionalBalance),
      ].filter(value => value > 0)) || 0
    ).filter(value => value > 0)
  );
  if (powerScores !== null) return clampPercent(powerScores);

  const rosterHealth = average(
    (input.managerRosterIntelligence || [])
      .map(row => positiveNumber(row.rosterHealthScore))
      .filter(value => value > 0)
  );
  if (rosterHealth !== null) return clampPercent(rosterHealth);

  const valueSpreadRows = input.managerRosterValueGrowth || [];
  if (valueSpreadRows.length >= 2) {
    const values = valueSpreadRows.map(row => positiveNumber(row.total_val)).filter(Boolean);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max > 0 && min > 0) {
      return clampPercent(100 - Math.min(50, ((max - min) / max) * 100));
    }
  }

  return null;
}

function getLineupOptimizationScore(input: LeagueSharpnessInput): number | null {
  const starterSlotCount = input.leagueDiagnostics?.starterSlots?.length || 0;
  const rows = input.managerPositionCounts || [];
  if (starterSlotCount && rows.length) {
    const filledPct = average(rows.map(row => {
      const starterCount = row.starterPlayers?.length || row.lineupPlayers?.length || 0;
      return clampPercent((starterCount / starterSlotCount) * 100);
    }));
    if (filledPct !== null) return filledPct;
  }

  const weakStarterRows = input.managerRosterIntelligence || [];
  if (weakStarterRows.length) {
    const teamsWithWeakStarter = weakStarterRows.filter(row => row.weakestStarter).length;
    return clampPercent(92 - (teamsWithWeakStarter / weakStarterRows.length) * 18);
  }

  return null;
}

function getDraftDisciplineScore(input: LeagueSharpnessInput): number | null {
  const rows = input.draftStats || [];
  if (!rows.length) return null;

  const score = average(rows.map(row => {
    const total = Math.max(1, positiveNumber(row.totalPicks));
    const hitRate = (positiveNumber(row.hits) + positiveNumber(row.starters) * 0.5) / total;
    const adpDiscipline = 100 - Math.min(45, Math.abs(safeNumber(row.avgAdpDiff)) * 2.5);
    const valueGain = clampPercent(50 + safeNumber(row.avgKtcGain) / 60);
    return clampPercent(hitRate * 50 + adpDiscipline * 0.3 + valueGain * 0.2);
  }));

  return score === null ? null : clampPercent(score);
}

function getSourceDepthScore(input: LeagueSharpnessInput, sampleSize: number, teamCount: number): number {
  const playerDetailCount = Object.keys(input.playerDetailsById || {}).length;
  const rankingRows = Object.values(input.rankings?.profiles || {}).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0
  );
  return clampPercent(
    scorePerTeam(sampleSize, teamCount * 5) * 0.48 +
      Math.min(100, playerDetailCount / Math.max(1, teamCount * 18) * 100) * 0.32 +
      Math.min(100, rankingRows / 250 * 100) * 0.2
  );
}

function getInactiveManagerCount(input: LeagueSharpnessInput): number {
  const managers = new Map<string, { moves: number; trades: number }>();
  const addManager = (manager?: string | null) => {
    const key = String(manager || "").trim().toLowerCase();
    if (key && !managers.has(key)) managers.set(key, { moves: 0, trades: 0 });
    return key;
  };

  input.managerRosterIntelligence?.forEach(row => addManager(row.manager));
  input.managerPositionCounts?.forEach(row => addManager(row.manager));
  input.tradeTendencies?.forEach(row => {
    const key = addManager(row.manager);
    const current = managers.get(key);
    if (current) current.trades += positiveNumber(row.tradeCount);
  });
  input.recentTransactions?.forEach(row => {
    const key = addManager(row.manager);
    const current = managers.get(key);
    if (current) current.moves += 1;
  });

  if (!managers.size) return 0;
  return Array.from(managers.values()).filter(row => row.moves <= 0 && row.trades <= 0).length;
}

function signalStatus(score: number, sampleSize: number): LeagueSharpnessSignalStatus {
  if (sampleSize < 3 || score < 35) return "thin";
  if (sampleSize < 10 || score < 60) return "building";
  return "strong";
}

function getTier(score: number): LeagueSharpnessTier {
  if (score >= 86) return "shark-tank";
  if (score >= 72) return "sharp";
  if (score >= 54) return "average";
  if (score >= 36) return "casual";
  return "sleepy";
}

function getLabel(tier: LeagueSharpnessTier): string {
  if (tier === "shark-tank") return "Shark tank";
  if (tier === "sharp") return "Sharp league";
  if (tier === "average") return "Average league";
  if (tier === "casual") return "Casual league";
  return "Sleepy league";
}

function getActionBias(tier: LeagueSharpnessTier): LeagueSharpnessProfile["actionBias"] {
  if (tier === "shark-tank") return "overpay-or-pass";
  if (tier === "sharp") return "attack";
  if (tier === "casual") return "snipe";
  if (tier === "sleepy") return "wait";
  return "balanced";
}

function getNote(profile: Pick<LeagueSharpnessProfile, "tier" | "tradeSignalsPerTeam" | "waiverSignalsPerTeam" | "inactiveManagerCount">): string {
  if (profile.tier === "shark-tank") return "Assume good ideas get noticed fast; act hard or pass.";
  if (profile.tier === "sharp") return "Good edges should be acted on before the market catches up.";
  if (profile.tier === "casual") return "You can snipe edges without paying full sharp-league prices.";
  if (profile.tier === "sleepy") return "Patience has value because the room is not forcing every edge.";
  if (profile.inactiveManagerCount) return "The league has some soft spots, but enough activity to stay honest.";
  if (profile.tradeSignalsPerTeam >= 1 || profile.waiverSignalsPerTeam >= 2) return "The room is active enough that timing matters.";
  return "Treat the room as balanced until more behavior resolves.";
}

export function buildLeagueSharpnessProfile(
  input?: LeagueSharpnessInput | null
): LeagueSharpnessProfile | null {
  if (!input) return null;

  const teamCount = getTeamCount(input);
  const activity = getActivitySignals(input, teamCount);
  const rosterQualityScore = getRosterQualityScore(input);
  const lineupScore = getLineupOptimizationScore(input);
  const draftScore = getDraftDisciplineScore(input);
  const sourceDepthScore = getSourceDepthScore(input, activity.sampleSize, teamCount);
  const inactiveManagerCount = getInactiveManagerCount(input);
  const inactivePenalty = managersWithActivityPenalty(inactiveManagerCount, teamCount);

  const tradeMarketScore = scorePerTeam(activity.tradeSignalsPerTeam, 1.6);
  const waiverMarketScore = scorePerTeam(activity.waiverSignalsPerTeam, 3.4);
  const transactionScore = scorePerTeam(activity.transactionSignalsPerTeam, 4.8);
  const activityScore = clampPercent(
    tradeMarketScore * 0.34 + waiverMarketScore * 0.42 + transactionScore * 0.24 - inactivePenalty
  );

  const signals: LeagueSharpnessSignal[] = [
    {
      key: "activity",
      label: "Activity",
      score: activityScore,
      weight: 0.28,
      status: signalStatus(activityScore, activity.sampleSize),
      note: `${roundOne(activity.transactionSignalsPerTeam)} transactions/team, ${roundOne(activity.waiverSignalsPerTeam)} waiver signals/team.`,
    },
    {
      key: "trade-market",
      label: "Trade market",
      score: tradeMarketScore,
      weight: 0.16,
      status: signalStatus(tradeMarketScore, Math.round(activity.tradeSignals)),
      note: `${roundOne(activity.tradeSignalsPerTeam)} trade signals/team.`,
    },
    {
      key: "roster-quality",
      label: "Roster quality",
      score: rosterQualityScore ?? 52,
      weight: rosterQualityScore === null ? 0.08 : 0.18,
      status: rosterQualityScore === null ? "thin" : signalStatus(rosterQualityScore, input.managerRosterIntelligence?.length || input.powerRankings?.length || 0),
      note: rosterQualityScore === null ? "Roster-quality inputs are thin." : "Roster health and power rows are loaded.",
    },
    {
      key: "lineup-discipline",
      label: "Lineup discipline",
      score: lineupScore ?? 50,
      weight: lineupScore === null ? 0.06 : 0.14,
      status: lineupScore === null ? "thin" : signalStatus(lineupScore, input.managerPositionCounts?.length || 0),
      note: lineupScore === null ? "Starter-slot coverage is not fully loaded." : "Starter coverage can be compared across managers.",
    },
    {
      key: "draft-discipline",
      label: "Draft discipline",
      score: draftScore ?? 50,
      weight: draftScore === null ? 0.04 : 0.12,
      status: draftScore === null ? "thin" : signalStatus(draftScore, input.draftStats?.length || 0),
      note: draftScore === null ? "Draft-result inputs are not loaded yet." : "Draft hit/miss and ADP discipline are loaded.",
    },
    {
      key: "source-depth",
      label: "Source depth",
      score: sourceDepthScore,
      weight: 0.12,
      status: signalStatus(sourceDepthScore, activity.sampleSize),
      note: `${activity.sampleSize} behavior samples plus report source coverage.`,
    },
  ];

  const weightTotal = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const score = clampPercent(
    signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0) /
      Math.max(0.01, weightTotal)
  );
  const tier = getTier(score);
  const confidence = activity.sampleSize >= teamCount * 4 && signals.filter(signal => signal.status === "strong").length >= 2
    ? "usable"
    : activity.sampleSize >= teamCount || signals.filter(signal => signal.status !== "thin").length >= 3
      ? "building"
      : "thin";

  return {
    score,
    tier,
    label: getLabel(tier),
    actionBias: getActionBias(tier),
    confidence,
    note: getNote({
      tier,
      tradeSignalsPerTeam: activity.tradeSignalsPerTeam,
      waiverSignalsPerTeam: activity.waiverSignalsPerTeam,
      inactiveManagerCount,
    }),
    sampleSize: activity.sampleSize,
    teamCount,
    inactiveManagerCount,
    tradeSignalsPerTeam: roundOne(activity.tradeSignalsPerTeam),
    waiverSignalsPerTeam: roundOne(activity.waiverSignalsPerTeam),
    transactionSignalsPerTeam: roundOne(activity.transactionSignalsPerTeam),
    signals,
  };
}

function managersWithActivityPenalty(inactiveManagerCount: number, teamCount: number): number {
  if (!inactiveManagerCount || !teamCount) return 0;
  return Math.min(22, (inactiveManagerCount / teamCount) * 38);
}
