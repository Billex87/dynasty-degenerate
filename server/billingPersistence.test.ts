import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countUsageEvents,
  findBillingCustomerForUser,
  listBillingSubscriptionsForUser,
  recordUsageEvent,
  upsertFeatureEntitlement,
  upsertBillingCustomer,
  upsertBillingSubscription,
  upsertLeaguePass,
} from "./db";

describe("billing persistence helpers", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("fails safely when billing customer persistence has no database", async () => {
    await expect(upsertBillingCustomer({
      userOpenId: "email:user",
      stripeCustomerId: "cus_test",
      email: "sample@example.com",
      name: "Sample User",
      metadata: { source: "test" },
    })).resolves.toBe(false);
  });

  it("fails safely when subscription persistence has no database", async () => {
    await expect(upsertBillingSubscription({
      userOpenId: "email:user",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      plan: "Pro",
      status: "Active",
      priceId: "price_test",
      productId: "prod_test",
      currentPeriodStart: "2026-06-02T00:00:00.000Z",
      currentPeriodEnd: "2026-07-02T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      metadata: { source: "test" },
    })).resolves.toBe(false);
  });

  it("fails safely when subscription reads have no database", async () => {
    await expect(listBillingSubscriptionsForUser("email:user")).resolves.toEqual([]);
  });

  it("fails safely when billing customer reads have no database", async () => {
    await expect(findBillingCustomerForUser("email:user")).resolves.toBeNull();
  });

  it("fails safely when league-pass persistence has no database", async () => {
    await expect(upsertLeaguePass({
      leagueId: "123456789012345678",
      purchaserOpenId: "email:user",
      stripeCustomerId: "cus_test",
      stripeCheckoutSessionId: "cs_test",
      status: "active",
      metadata: { source: "test" },
    })).resolves.toBe(false);
  });

  it("fails safely when feature-entitlement persistence has no database", async () => {
    await expect(upsertFeatureEntitlement({
      subjectType: "user",
      userOpenId: "email:user",
      featureKey: "draft-kit-tools",
      plan: "one-time",
      source: "stripe",
      sourceId: "cs_test",
      status: "active",
      metadata: { source: "test" },
    })).resolves.toBe(false);
  });

  it("fails safely when usage event persistence has no database", async () => {
    await expect(recordUsageEvent({
      eventId: "usage:test",
      userOpenId: "email:user",
      leagueId: "123456789012345678",
      featureKey: "free-sleeper-report",
      usageKey: "daily-report",
      quantity: 1,
      source: "test",
      metadata: { route: "league.analyze" },
      createdAt: "2026-06-02T00:00:00.000Z",
    })).resolves.toBe(false);
  });

  it("returns zero usage counts when no database is configured", async () => {
    await expect(countUsageEvents({
      userOpenId: "email:user",
      featureKey: "free-sleeper-report",
      usageKey: "daily-report",
      createdAtFrom: "2026-06-02T00:00:00.000Z",
      createdAtTo: "2026-06-03T00:00:00.000Z",
    })).resolves.toBe(0);
  });

  it("validates required identifiers before attempting database work", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await expect(upsertBillingCustomer({
        userOpenId: "",
        stripeCustomerId: "cus_test",
      })).rejects.toThrow(/userOpenId is required/);

      await expect(upsertBillingSubscription({
        userOpenId: "email:user",
        stripeCustomerId: "",
        stripeSubscriptionId: "sub_test",
        plan: "pro",
        status: "active",
      })).rejects.toThrow(/stripeCustomerId is required/);

      await expect(recordUsageEvent({
        eventId: "usage:test",
        featureKey: "",
        usageKey: "daily-report",
        source: "test",
      })).rejects.toThrow(/featureKey is required/);

      await expect(upsertLeaguePass({
        leagueId: "",
        purchaserOpenId: "email:user",
        stripeCheckoutSessionId: "cs_test",
        status: "active",
      })).rejects.toThrow(/leagueId is required/);

      await expect(upsertFeatureEntitlement({
        subjectType: "league",
        featureKey: "source-trace-details",
        source: "stripe",
        sourceId: "cs_test",
        status: "active",
      })).rejects.toThrow(/leagueId is required/);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
