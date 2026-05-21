import type { AIEvidenceLeagueActivityContext, AIEvidenceLeagueTempo } from "./aiEvidenceEngine";
import { buildLeagueSharpnessProfile } from "./leagueSharpness";
import type { ReportData } from "./types";

type LeagueActivityReportInput = Partial<Pick<
  ReportData,
  | "leagueDiagnostics"
  | "tradeHistory"
  | "tradeTendencies"
  | "tradeProposalSignals"
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

function safeCount(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function tempoFromPerTeam(value: number, thresholds: [number, number, number]): AIEvidenceLeagueTempo {
  if (!Number.isFinite(value) || value <= 0) return "unknown";
  if (value < thresholds[0]) return "quiet";
  if (value < thresholds[1]) return "balanced";
  if (value < thresholds[2]) return "active";
  return "hyperactive";
}

function roundCount(value: number): number {
  return Math.max(0, Math.round(value));
}

function maxPerSeason(total: number, seasonCount?: number | null): number {
  const seasons = Math.max(1, roundCount(seasonCount || 1));
  return total / seasons;
}

function getTeamCount(input?: LeagueActivityReportInput | null): number {
  return Math.max(1, safeCount(input?.leagueDiagnostics?.teamCount) || 12);
}

export function buildAIEvidenceLeagueActivityContext(
  input?: LeagueActivityReportInput | null
): AIEvidenceLeagueActivityContext | null {
  if (!input) return null;

  const teamCount = getTeamCount(input);
  const backfill = input.transactionBackfillDiagnostics;
  const backfillSeasons = safeCount(backfill?.seasonCount) || 1;
  const completedTradesPerSeason = maxPerSeason(safeCount(backfill?.completedTradeCount), backfillSeasons);
  const waiverMovesPerSeason = maxPerSeason(safeCount(backfill?.waiverOrFreeAgentCount), backfillSeasons);
  const transactionsPerSeason = maxPerSeason(safeCount(backfill?.transactionCount), backfillSeasons);
  const currentTradeSignals = Math.max(
    safeCount(input.tradeHistory?.length),
    safeCount(input.sleeperHiddenLeagueSnapshot?.tradeCount),
    completedTradesPerSeason
  );
  const tradeProposalSignals = Math.max(
    safeCount(input.tradeProposalSignals?.length),
    safeCount(input.adminSleeperTradeProposalSignals?.length)
  );
  const managerTradeSignals = Math.max(
    safeCount(input.tradeTendencies?.length),
    safeCount(input.tradeTendencies?.reduce((sum, row) => sum + safeCount(row.tradeCount), 0))
  );
  const recentTransactions = safeCount(input.recentTransactions?.length);
  const waiverPoolSignals = Math.max(
    safeCount(input.waiverIntelligence?.availableTrendingAdds?.length),
    safeCount(input.waiverIntelligence?.weeklyEcrTargets?.length),
    safeCount(input.adminSleeperWaiverSignals?.length)
  );
  const currentWaiverSignals = Math.max(
    recentTransactions,
    safeCount(input.sleeperHiddenLeagueSnapshot?.waiverCount),
    waiverMovesPerSeason,
    waiverPoolSignals
  );
  const transactionSignals = Math.max(
    recentTransactions,
    safeCount(input.sleeperHiddenLeagueSnapshot?.transactionCount),
    transactionsPerSeason
  );
  const tradeSignalCount = currentTradeSignals + tradeProposalSignals * 0.5 + managerTradeSignals * 0.25;
  const waiverSignalCount = currentWaiverSignals;
  const sampleSize = roundCount(tradeSignalCount + waiverSignalCount + transactionSignals);

  if (sampleSize <= 0) return null;

  const tradeTempo = tempoFromPerTeam(tradeSignalCount / teamCount, [0.35, 1.1, 2.2]);
  const waiverTempo = tempoFromPerTeam(waiverSignalCount / teamCount, [0.75, 2.25, 4.5]);
  const sharpness = buildLeagueSharpnessProfile(input);
  const evidenceLabel = [
    sharpness?.label || null,
    tradeTempo !== "unknown" ? `${tradeTempo} trade market` : null,
    waiverTempo !== "unknown" ? `${waiverTempo} waiver market` : null,
    `${roundCount(tradeSignalCount)} trade signals`,
    `${roundCount(waiverSignalCount)} waiver signals`,
  ].filter(Boolean).join(" · ");

  return {
    tradeTempo,
    waiverTempo,
    sharpnessScore: sharpness?.score ?? null,
    sharpnessTier: sharpness?.tier ?? null,
    sharpnessLabel: sharpness?.label ?? null,
    sharpnessActionBias: sharpness?.actionBias ?? null,
    tradeSignalCount: roundCount(tradeSignalCount),
    waiverSignalCount: roundCount(waiverSignalCount),
    transactionSignalCount: roundCount(transactionSignals),
    sampleSize,
    evidenceLabel,
  };
}
