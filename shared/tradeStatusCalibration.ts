import type { TradeProposalSignal } from "./types";

export type TradeStatusBucket =
  | "accepted"
  | "countered"
  | "blocked"
  | "pending"
  | "unknown";

export type TradeStatusActionBias =
  | "send"
  | "soften"
  | "wait"
  | "avoid"
  | "learn-more";

export interface TradeStatusCalibrationRow {
  manager: string;
  signalCount: number;
  acceptedCount: number;
  counterCount: number;
  blockedCount: number;
  pendingCount: number;
  unknownCount: number;
  completionRate: number | null;
  blockedRate: number | null;
  counterRate: number | null;
  actionBias: TradeStatusActionBias;
  label: string;
  note: string;
}

export interface TradeStatusCalibrationSummary {
  schemaVersion: 1;
  generatedFrom: "trade-proposal-signals";
  signalCount: number;
  rows: TradeStatusCalibrationRow[];
}

function normalizeManagerKey(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

export function normalizeTradeStatusBucket(status?: string | null): TradeStatusBucket {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (/complete|completed|accept|accepted|processed/.test(normalized)) return "accepted";
  if (/counter/.test(normalized)) return "countered";
  if (/declin|reject|cancel|veto|fail|expire|block/.test(normalized)) return "blocked";
  if (/pending|open|propos|active|waiting|review/.test(normalized)) return "pending";
  return "unknown";
}

function pct(count: number, total: number): number | null {
  if (!total) return null;
  return Math.round((count / total) * 100);
}

function buildTradeStatusRow(manager: string, buckets: TradeStatusBucket[]): TradeStatusCalibrationRow {
  const signalCount = buckets.length;
  const acceptedCount = buckets.filter(bucket => bucket === "accepted").length;
  const counterCount = buckets.filter(bucket => bucket === "countered").length;
  const blockedCount = buckets.filter(bucket => bucket === "blocked").length;
  const pendingCount = buckets.filter(bucket => bucket === "pending").length;
  const unknownCount = buckets.filter(bucket => bucket === "unknown").length;
  const resolvedCount = acceptedCount + counterCount + blockedCount;
  const completionRate = pct(acceptedCount, resolvedCount);
  const blockedRate = pct(blockedCount, resolvedCount);
  const counterRate = pct(counterCount, resolvedCount);

  let actionBias: TradeStatusActionBias = "learn-more";
  let label = "Learning trade habits";
  if (signalCount >= 3 && acceptedCount >= 2 && (completionRate || 0) >= 50) {
    actionBias = "send";
    label = "Trade-friendly";
  } else if (signalCount >= 2 && counterCount >= blockedCount && counterCount > 0) {
    actionBias = "soften";
    label = "Counter-heavy";
  } else if (signalCount >= 2 && pendingCount > resolvedCount) {
    actionBias = "wait";
    label = "Slow responder";
  } else if (signalCount >= 2 && blockedCount >= Math.max(1, acceptedCount + counterCount)) {
    actionBias = "avoid";
    label = "Rejects often";
  }

  const noteParts = [
    `${signalCount} visible proposal signal${signalCount === 1 ? "" : "s"}`,
    acceptedCount ? `${acceptedCount} accepted` : null,
    counterCount ? `${counterCount} countered` : null,
    blockedCount ? `${blockedCount} blocked` : null,
    pendingCount ? `${pendingCount} pending` : null,
  ].filter(Boolean);

  return {
    manager,
    signalCount,
    acceptedCount,
    counterCount,
    blockedCount,
    pendingCount,
    unknownCount,
    completionRate,
    blockedRate,
    counterRate,
    actionBias,
    label,
    note: noteParts.join(", "),
  };
}

export function buildTradeStatusCalibration(
  signals: TradeProposalSignal[] = []
): TradeStatusCalibrationSummary {
  const managerBuckets = new Map<string, { manager: string; buckets: TradeStatusBucket[] }>();

  for (const signal of signals) {
    const bucket = normalizeTradeStatusBucket(signal.status);
    for (const manager of signal.managers || []) {
      const key = normalizeManagerKey(manager);
      if (!key) continue;
      const row = managerBuckets.get(key) || { manager, buckets: [] };
      row.buckets.push(bucket);
      managerBuckets.set(key, row);
    }
  }

  return {
    schemaVersion: 1,
    generatedFrom: "trade-proposal-signals",
    signalCount: signals.length,
    rows: Array.from(managerBuckets.values())
      .map(row => buildTradeStatusRow(row.manager, row.buckets))
      .sort((a, b) => b.signalCount - a.signalCount || a.manager.localeCompare(b.manager)),
  };
}

export function getTradeStatusCalibrationForManager(
  summary: TradeStatusCalibrationSummary | null | undefined,
  manager?: string | null
): TradeStatusCalibrationRow | null {
  const key = normalizeManagerKey(manager);
  if (!key) return null;
  return summary?.rows.find(row => normalizeManagerKey(row.manager) === key) || null;
}
