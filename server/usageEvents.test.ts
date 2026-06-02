import { describe, expect, it } from "vitest";
import {
  buildUsageEvent,
  buildUsageEventId,
  checkUsageLimit,
  getUsageKey,
  getUsagePeriodWindow,
  sumUsageQuantity,
} from "./usageEvents";

describe("usage events", () => {
  it("builds UTC day, month, and season windows", () => {
    const now = new Date("2026-06-02T22:15:00.000Z");

    expect(getUsagePeriodWindow({ period: "day", now })).toEqual({
      windowStart: new Date("2026-06-02T00:00:00.000Z"),
      windowEnd: new Date("2026-06-03T00:00:00.000Z"),
    });
    expect(getUsagePeriodWindow({ period: "month", now })).toEqual({
      windowStart: new Date("2026-06-01T00:00:00.000Z"),
      windowEnd: new Date("2026-07-01T00:00:00.000Z"),
    });
    expect(getUsagePeriodWindow({ period: "season", now })).toEqual({
      windowStart: new Date("2025-08-01T00:00:00.000Z"),
      windowEnd: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it("builds stable usage keys from the feature, period, and window start", () => {
    expect(getUsageKey({
      featureKey: "monthly-roster-blueprint",
      period: "month",
      now: new Date("2026-06-15T12:00:00.000Z"),
    })).toBe("monthly-roster-blueprint:month:2026-06-01");
  });

  it("builds deterministic event IDs from idempotency inputs", () => {
    const input = {
      featureKey: "monthly-roster-blueprint",
      usageKey: "monthly-roster-blueprint:month:2026-06-01",
      userOpenId: "auth:sample-user",
      leagueId: "123456789012345678",
      source: "monthly-report-generation",
      idempotencyKey: "2026-06|123456789012345678",
    };

    expect(buildUsageEventId(input)).toBe(buildUsageEventId(input));
    expect(buildUsageEventId({
      ...input,
      idempotencyKey: "2026-06|999999999999999999",
    })).not.toBe(buildUsageEventId(input));
  });

  it("sums usage quantities defensively", () => {
    expect(sumUsageQuantity([
      { quantity: 1 },
      { quantity: 2 },
      { quantity: -4 },
      { quantity: Number.NaN },
    ])).toBe(3);
  });

  it("checks usage limits with remaining count and window metadata", () => {
    const result = checkUsageLimit({
      events: [{ quantity: 1 }, { quantity: 2 }],
      limit: 4,
      period: "day",
      now: new Date("2026-06-02T12:00:00.000Z"),
    });

    expect(result).toMatchObject({
      allowed: true,
      used: 3,
      remaining: 1,
      limit: 4,
      period: "day",
      windowStart: new Date("2026-06-02T00:00:00.000Z"),
      windowEnd: new Date("2026-06-03T00:00:00.000Z"),
    });

    expect(checkUsageLimit({
      events: [{ quantity: 4 }],
      limit: 4,
      period: "day",
      now: new Date("2026-06-02T12:00:00.000Z"),
    }).allowed).toBe(false);
  });

  it("builds idempotent usage event input records", () => {
    const now = new Date("2026-06-02T12:00:00.000Z");
    const event = buildUsageEvent({
      userOpenId: "auth:sample-user",
      leagueId: "123456789012345678",
      featureKey: "monthly-roster-blueprint",
      period: "month",
      quantity: 1,
      source: "monthly-report-generation",
      idempotencyKey: "2026-06|123456789012345678",
      metadata: {
        snapshotMonth: "2026-06",
      },
      now,
    });

    expect(event).toMatchObject({
      userOpenId: "auth:sample-user",
      leagueId: "123456789012345678",
      featureKey: "monthly-roster-blueprint",
      usageKey: "monthly-roster-blueprint:month:2026-06-01",
      quantity: 1,
      source: "monthly-report-generation",
      metadata: {
        snapshotMonth: "2026-06",
      },
      createdAt: now,
    });
    expect(event.eventId).toMatch(/^[a-f0-9]{64}$/);
  });
});
