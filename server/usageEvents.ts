import crypto from "node:crypto";
import type { UsageEventInput } from "./db";

export type UsagePeriod = "day" | "month" | "season";

export type UsageLimitCheck = {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  period: UsagePeriod;
  windowStart: Date;
  windowEnd: Date;
};

export function getUsagePeriodWindow(input: {
  period: UsagePeriod;
  now?: Date;
}): { windowStart: Date; windowEnd: Date } {
  const now = input.now ?? new Date();

  if (input.period === "day") {
    return {
      windowStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      windowEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
    };
  }

  if (input.period === "month") {
    return {
      windowStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      windowEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }

  const seasonStartYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    windowStart: new Date(Date.UTC(seasonStartYear, 7, 1)),
    windowEnd: new Date(Date.UTC(seasonStartYear + 1, 7, 1)),
  };
}

export function getUsageKey(input: {
  featureKey: string;
  period: UsagePeriod;
  now?: Date;
}): string {
  const { windowStart } = getUsagePeriodWindow({ period: input.period, now: input.now });
  return `${input.featureKey}:${input.period}:${windowStart.toISOString().slice(0, 10)}`;
}

export function buildUsageEventId(input: {
  featureKey: string;
  usageKey: string;
  userOpenId?: string | null;
  leagueId?: string | null;
  source: string;
  idempotencyKey: string;
}): string {
  const raw = [
    input.featureKey,
    input.usageKey,
    input.userOpenId || "",
    input.leagueId || "",
    input.source,
    input.idempotencyKey,
  ].join("|");

  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

type UsageQuantity = {
  quantity: number;
};

export function sumUsageQuantity(events: UsageQuantity[]): number {
  return events.reduce((total, event) => total + Math.max(0, Number(event.quantity || 0)), 0);
}

export function checkUsageLimit(input: {
  events: UsageQuantity[];
  limit: number;
  period: UsagePeriod;
  now?: Date;
}): UsageLimitCheck {
  const { windowStart, windowEnd } = getUsagePeriodWindow({
    period: input.period,
    now: input.now,
  });
  const used = sumUsageQuantity(input.events);
  const limit = Math.max(0, Math.floor(input.limit));
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    used,
    remaining,
    limit,
    period: input.period,
    windowStart,
    windowEnd,
  };
}

export function buildUsageEvent(input: Omit<UsageEventInput, "eventId" | "usageKey"> & {
  period: UsagePeriod;
  idempotencyKey: string;
  now?: Date;
}): UsageEventInput {
  const createdAt = input.createdAt ?? input.now ?? new Date();
  const usageKey = getUsageKey({
    featureKey: input.featureKey,
    period: input.period,
    now: createdAt instanceof Date ? createdAt : new Date(createdAt),
  });

  return {
    ...input,
    eventId: buildUsageEventId({
      featureKey: input.featureKey,
      usageKey,
      userOpenId: input.userOpenId,
      leagueId: input.leagueId,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
    }),
    usageKey,
    createdAt,
  };
}
