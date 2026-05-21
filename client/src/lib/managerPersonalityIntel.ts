import type { ReportData } from "@shared/types";
import {
  buildTradeStatusCalibration,
  getTradeStatusCalibrationForManager,
} from "@shared/tradeStatusCalibration";

export type ManagerPersonalityTone = "good" | "info" | "warn" | "danger";

export interface ManagerPersonalityIntelRow {
  manager: string;
  activityScore: number;
  tradeStyle: string;
  waiverStyle: string;
  rosterStyle: string;
  actionRead: string;
  confidence: "thin" | "building" | "usable";
  tone: ManagerPersonalityTone;
  receipts: string[];
}

function normalizeManagerKey(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getManagerNames(data: ReportData): string[] {
  const names = new Map<string, string>();
  const add = (value?: string | null) => {
    const trimmed = String(value || "").trim();
    const key = normalizeManagerKey(trimmed);
    if (trimmed && key && !names.has(key)) names.set(key, trimmed);
  };

  data.currentStandings?.forEach(row => add(row.manager));
  data.leagueOverview?.forEach(row => add(row.manager));
  data.managerRosterIntelligence?.forEach(row => add(row.manager));
  data.managerPositionCounts?.forEach(row => add(row.manager));
  data.tradeTendencies?.forEach(row => add(row.manager));
  data.pickPortfolios?.forEach(row => add(row.manager));
  data.recentTransactions?.forEach(row => add(row.manager));
  data.tradeProposalSignals?.forEach(signal => signal.managers.forEach(add));
  data.adminTradeProposalSignals?.forEach(signal => signal.managers.forEach(add));
  data.adminSleeperTradeProposalSignals?.forEach(signal => signal.managers.forEach(add));

  return Array.from(names.values());
}

function getTradeStyle({
  tradeCount,
  winPct,
  overpaysForPicks,
  overpaysForVeterans,
  statusLabel,
}: {
  tradeCount: number;
  winPct: number;
  overpaysForPicks: boolean;
  overpaysForVeterans: boolean;
  statusLabel?: string | null;
}): string {
  if (statusLabel && statusLabel !== "Learning trade habits") return statusLabel;
  if (overpaysForPicks) return "Pick buyer";
  if (overpaysForVeterans) return "Veteran buyer";
  if (tradeCount >= 6) return "Active dealer";
  if (tradeCount <= 1) return "Slow mover";
  if (winPct >= 58) return "Profit seeker";
  return "Balanced trader";
}

function getWaiverStyle({
  waiverCount,
  freeAgentCount,
  avgBid,
}: {
  waiverCount: number;
  freeAgentCount: number;
  avgBid: number | null;
}): string {
  if (waiverCount >= 6 && avgBid !== null && avgBid >= 10) return "Aggressive bidder";
  if (waiverCount >= 5) return "Churn-heavy";
  if (avgBid !== null && avgBid <= 2 && freeAgentCount >= waiverCount) return "Free-agent sniper";
  if (freeAgentCount >= 4 && waiverCount <= 1) return "Free-agent watcher";
  if (waiverCount === 0 && freeAgentCount === 0) return "Quiet waivers";
  return "Selective claims";
}

function getRosterStyle({
  pickCount,
  taxiCount,
  reserveCount,
  droppableCount,
  timelineLabel,
}: {
  pickCount: number;
  taxiCount: number;
  reserveCount: number;
  droppableCount: number;
  timelineLabel?: string | null;
}): string {
  const label = String(timelineLabel || "").toLowerCase();
  if (pickCount >= 8) return "Pick hoarder";
  if (taxiCount >= 4) return "Rookie stash builder";
  if (/rebuild/.test(label)) return "Rebuild accumulator";
  if (/contend|win/.test(label)) return "Contender buyer";
  if (reserveCount >= 3) return "Injury stash holder";
  if (droppableCount >= 5) return "Loose bench";
  return "Balanced roster";
}

function getActionRead({
  tradeStyle,
  waiverStyle,
  rosterStyle,
  statusBias,
}: {
  tradeStyle: string;
  waiverStyle: string;
  rosterStyle: string;
  statusBias?: string | null;
}): string {
  if (statusBias === "avoid") return "Do not bother unless the offer is clearly juiced.";
  if (statusBias === "soften") return "Open softer and expect a counter.";
  if (statusBias === "wait") return "Send only clean offers; expect slow response.";
  if (/Aggressive|Churn/.test(waiverStyle)) return "Expect waiver pressure on obvious adds.";
  if (/Pick hoarder|Rookie stash/.test(rosterStyle)) return "Use youth or pick insulation in trade pitches.";
  if (/Active dealer|Trade-friendly/.test(tradeStyle)) return "Worth attacking with a clean fit-based offer.";
  return "Receipt only until more behavior resolves.";
}

export function buildManagerPersonalityIntelRows(
  data: ReportData
): ManagerPersonalityIntelRow[] {
  const managers = getManagerNames(data);
  const proposalSignals = [
    ...(data.tradeProposalSignals || []),
    ...(data.adminTradeProposalSignals || []),
    ...(data.adminSleeperTradeProposalSignals || []),
  ];
  const tradeStatusSummary = buildTradeStatusCalibration(proposalSignals);
  const tradeTendencyByManager = new Map(
    (data.tradeTendencies || []).map(row => [normalizeManagerKey(row.manager), row])
  );
  const intelByManager = new Map(
    (data.managerRosterIntelligence || []).map(row => [normalizeManagerKey(row.manager), row])
  );
  const picksByManager = new Map(
    (data.pickPortfolios || []).map(row => [normalizeManagerKey(row.manager), row])
  );
  const timelineByManager = new Map(
    (data.dynastyTimelines || []).map(row => [normalizeManagerKey(row.manager), row])
  );

  return managers.map(manager => {
    const key = normalizeManagerKey(manager);
    const tendency = tradeTendencyByManager.get(key);
    const status = getTradeStatusCalibrationForManager(tradeStatusSummary, manager);
    const intel = intelByManager.get(key);
    const picks = picksByManager.get(key);
    const timeline = timelineByManager.get(key);
    const transactions = (data.recentTransactions || []).filter(
      row => normalizeManagerKey(row.manager) === key
    );
    const waiverTransactions = transactions.filter(row => row.type === "Waiver");
    const freeAgentTransactions = transactions.filter(row => row.type === "Free Agent");
    const bidSamples = waiverTransactions
      .map(row => Number(row.bidAmount))
      .filter(value => Number.isFinite(value) && value >= 0);
    const avgBid = bidSamples.length
      ? Math.round(bidSamples.reduce((sum, value) => sum + value, 0) / bidSamples.length)
      : null;
    const futurePickCount =
      (picks?.count2025 || 0) +
      (picks?.count2026 || 0) +
      (picks?.count2027 || 0) +
      (picks?.count2028 || 0);
    const taxiCount = intel?.taxiPlayers?.length || 0;
    const reserveCount = intel?.reservePlayers?.length || 0;
    const droppableCount = intel?.droppablePlayers?.length || 0;
    const tradeCount = tendency?.tradeCount || 0;
    const tradeStyle = getTradeStyle({
      tradeCount,
      winPct: tendency?.winPct || 0,
      overpaysForPicks: Boolean(tendency?.overpaysForPicks),
      overpaysForVeterans: Boolean(tendency?.overpaysForVeterans),
      statusLabel: status?.label,
    });
    const waiverStyle = getWaiverStyle({
      waiverCount: waiverTransactions.length,
      freeAgentCount: freeAgentTransactions.length,
      avgBid,
    });
    const rosterStyle = getRosterStyle({
      pickCount: futurePickCount,
      taxiCount,
      reserveCount,
      droppableCount,
      timelineLabel: timeline?.label,
    });
    const evidenceCount = [
      tradeCount > 0,
      Boolean(status?.signalCount),
      transactions.length > 0,
      Boolean(intel),
      Boolean(picks),
      Boolean(timeline),
    ].filter(Boolean).length;
    const activityScore = clampScore(
      tradeCount * 8 +
        transactions.length * 5 +
        (status?.signalCount || 0) * 6 +
        futurePickCount * 2 +
        (intel ? 12 : 0)
    );
    const confidence: ManagerPersonalityIntelRow["confidence"] =
      evidenceCount >= 4 ? "usable" : evidenceCount >= 2 ? "building" : "thin";
    const tone: ManagerPersonalityTone =
      confidence === "usable" ? "good" : confidence === "building" ? "warn" : "danger";
    const receipts = [
      `${tradeCount} completed trade${tradeCount === 1 ? "" : "s"}`,
      status?.signalCount ? `${status.signalCount} proposal signal${status.signalCount === 1 ? "" : "s"}` : null,
      `${transactions.length} recent move${transactions.length === 1 ? "" : "s"}`,
      futurePickCount ? `${futurePickCount} tracked pick${futurePickCount === 1 ? "" : "s"}` : null,
      taxiCount ? `${taxiCount} taxi` : null,
      avgBid !== null ? `avg bid ${avgBid}` : null,
    ].filter(Boolean) as string[];

    return {
      manager,
      activityScore,
      tradeStyle,
      waiverStyle,
      rosterStyle,
      actionRead: getActionRead({
        tradeStyle,
        waiverStyle,
        rosterStyle,
        statusBias: status?.actionBias,
      }),
      confidence,
      tone,
      receipts,
    };
  }).sort((a, b) => b.activityScore - a.activityScore || a.manager.localeCompare(b.manager));
}
