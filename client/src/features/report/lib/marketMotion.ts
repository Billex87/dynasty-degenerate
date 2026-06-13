import type { RecentTransaction, ReportData, WeeklyMomentum } from "@shared/types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type MarketMoverDirection = "up" | "down";

export type MarketMoverItem = {
  id: string;
  name: string;
  owner: string;
  position: string;
  direction: MarketMoverDirection;
  value: number;
  valueLabel: string;
  pctChange: number;
  pctLabel: string;
  diff: number;
  diffLabel: string;
};

export type TransactionBucketMode = "timestamped" | "activity" | "empty";

export type TransactionActivityBucket = {
  key: string;
  label: string;
  count: number;
};

export type TransactionActivitySeries = {
  mode: TransactionBucketMode;
  buckets: TransactionActivityBucket[];
  total: number;
  note: string;
};

export type HeadToHeadManagerValue = {
  manager: string;
  totalValue: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function trimTrailingDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatMarketCompactValue(value?: number | null): string {
  if (!isFiniteNumber(value)) return "-";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${trimTrailingDecimal(Math.round((value / 1_000_000) * 10) / 10)}M`;
  }
  if (absolute >= 1_000) {
    return `${trimTrailingDecimal(Math.round((value / 1_000) * 10) / 10)}K`;
  }
  return Math.round(value).toLocaleString("en-US");
}

export function formatMarketSignedNumber(value?: number | null): string {
  if (!isFiniteNumber(value)) return "-";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("en-US")}`;
}

export function formatMarketSignedPercent(value?: number | null): string {
  if (!isFiniteNumber(value)) return "-";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${trimTrailingDecimal(rounded)}%`;
}

function toMarketMoverItem(
  mover: WeeklyMomentum,
  direction: MarketMoverDirection,
  index: number,
): MarketMoverItem {
  const pctChange = isFiniteNumber(mover.pct_change) ? mover.pct_change : 0;
  const diff = isFiniteNumber(mover.diff) ? mover.diff : 0;
  const value = isFiniteNumber(mover.val_now) ? mover.val_now : 0;

  return {
    id: `${direction}-${mover.player_id || mover.name}-${index}`,
    name: mover.name || "Unknown player",
    owner: mover.owner || "Market",
    position: mover.pos || mover.currentPositionRank || "FLEX",
    direction,
    value,
    valueLabel: formatMarketCompactValue(value),
    pctChange,
    pctLabel: formatMarketSignedPercent(pctChange),
    diff,
    diffLabel: formatMarketSignedNumber(diff),
  };
}

export function buildMarketMoverItems({
  risers,
  fallers,
  limit = 10,
}: {
  risers?: WeeklyMomentum[];
  fallers?: WeeklyMomentum[];
  limit?: number;
}): MarketMoverItem[] {
  return [
    ...(risers || []).map((mover, index) =>
      toMarketMoverItem(mover, "up", index)
    ),
    ...(fallers || []).map((mover, index) =>
      toMarketMoverItem(mover, "down", index)
    ),
  ]
    .filter(item => item.name && item.name !== "Unknown player")
    .sort(
      (a, b) =>
        Math.abs(b.pctChange) - Math.abs(a.pctChange) ||
        Math.abs(b.diff) - Math.abs(a.diff) ||
        b.value - a.value
    )
    .slice(0, Math.max(0, limit));
}

function parseTransactionTime(transaction: RecentTransaction): number | null {
  const parsed = Date.parse(transaction.date || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function getUtcWeekStart(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday,
  );
}

function formatWeekLabel(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function buildActivityFallbackBuckets(
  transactions: RecentTransaction[],
  maxBuckets: number,
): TransactionActivitySeries {
  const bucketCount = Math.min(maxBuckets, Math.max(1, transactions.length));
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    key: `activity-${index}`,
    label: `Recent ${index + 1}`,
    count: 0,
  }));

  transactions.forEach((_, index) => {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor((index / Math.max(1, transactions.length)) * bucketCount),
    );
    buckets[bucketIndex].count += 1;
  });

  return {
    mode: "activity",
    buckets,
    total: transactions.length,
    note: "Transaction dates were not usable, so this is a recent-activity sparkline in report order.",
  };
}

export function buildTransactionActivitySeries(
  transactions: RecentTransaction[] = [],
  maxBuckets = 6,
): TransactionActivitySeries {
  const usableMaxBuckets = Math.max(1, maxBuckets);
  const parsed = transactions
    .map(transaction => ({
      transaction,
      time: parseTransactionTime(transaction),
    }))
    .filter(
      (entry): entry is { transaction: RecentTransaction; time: number } =>
        entry.time !== null,
    );

  if (!transactions.length) {
    return {
      mode: "empty",
      buckets: [],
      total: 0,
      note: "No recent transaction activity was included in this report.",
    };
  }

  if (!parsed.length) {
    return buildActivityFallbackBuckets(transactions, usableMaxBuckets);
  }

  const weekStarts = parsed.map(entry => getUtcWeekStart(entry.time));
  const firstWeek = Math.min(...weekStarts);
  const lastWeek = Math.max(...weekStarts);
  const availableWeeks = Math.floor((lastWeek - firstWeek) / WEEK_MS) + 1;
  const bucketCount = Math.min(usableMaxBuckets, Math.max(1, availableWeeks));
  const startWeek = lastWeek - (bucketCount - 1) * WEEK_MS;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const weekStart = startWeek + index * WEEK_MS;
    return {
      key: `week-${weekStart}`,
      label: formatWeekLabel(weekStart),
      count: 0,
    };
  });

  parsed.forEach(entry => {
    const weekStart = getUtcWeekStart(entry.time);
    if (weekStart < startWeek || weekStart > lastWeek) return;
    const bucketIndex = Math.floor((weekStart - startWeek) / WEEK_MS);
    buckets[bucketIndex].count += 1;
  });

  return {
    mode: "timestamped",
    buckets,
    total: parsed.length,
    note:
      parsed.length === transactions.length
        ? "Weekly buckets use transaction timestamps from the report."
        : "Weekly buckets use only transactions with parseable timestamps.",
  };
}

function formatPathNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function buildMarketPulsePath(
  buckets: TransactionActivityBucket[],
  width: number,
  height: number,
): string {
  if (!buckets.length || width <= 0 || height <= 0) return "";

  const baseline = height * 0.68;
  const maxCount = Math.max(...buckets.map(bucket => bucket.count), 1);
  const usableWidth = Math.max(1, width - 8);
  const startX = 4;
  const step = buckets.length > 1 ? usableWidth / (buckets.length - 1) : 0;
  const points: string[] = [`M ${formatPathNumber(startX)} ${formatPathNumber(baseline)}`];

  buckets.forEach((bucket, index) => {
    const centerX = buckets.length > 1 ? startX + index * step : width / 2;
    const halfBeat = buckets.length > 1 ? Math.min(14, Math.max(7, step * 0.18)) : 18;
    const amplitude = bucket.count > 0
      ? 8 + (bucket.count / maxCount) * (height * 0.48)
      : 3;
    const highY = Math.max(4, baseline - amplitude);
    const lowY = Math.min(height - 4, baseline + amplitude * 0.32);

    points.push(
      `L ${formatPathNumber(Math.max(0, centerX - halfBeat))} ${formatPathNumber(baseline)}`,
      `L ${formatPathNumber(centerX)} ${formatPathNumber(highY)}`,
      `L ${formatPathNumber(Math.min(width, centerX + halfBeat * 0.42))} ${formatPathNumber(lowY)}`,
      `L ${formatPathNumber(Math.min(width, centerX + halfBeat))} ${formatPathNumber(baseline)}`,
    );
  });

  points.push(`L ${formatPathNumber(width)} ${formatPathNumber(baseline)}`);
  return points.join(" ");
}

export function buildHeadToHeadManagerValues(
  reportData: ReportData,
): HeadToHeadManagerValue[] {
  const values = new Map<string, number>();

  (reportData.leagueOverview || []).forEach(row => {
    if (row.manager && isFiniteNumber(row.total_val)) {
      values.set(row.manager, row.total_val);
    }
  });

  (reportData.managerRosterValueGrowth || []).forEach(row => {
    if (row.manager && isFiniteNumber(row.total_val)) {
      values.set(row.manager, row.total_val);
    }
  });

  return Array.from(values, ([manager, totalValue]) => ({
    manager,
    totalValue,
  })).sort((a, b) => b.totalValue - a.totalValue);
}
