import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { canUseFeature, getUserBillingPlan } from "./featureEntitlements";

const baseUser: User = {
  id: 1,
  openId: "sample-user",
  name: "Sample User",
  email: "sample@example.com",
  loginMethod: "test",
  role: "user",
  createdAt: new Date("2026-06-02T00:00:00.000Z"),
  updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  lastSignedIn: new Date("2026-06-02T00:00:00.000Z"),
};

describe("feature entitlements", () => {
  it("keeps the public Sleeper report path available for anonymous users", () => {
    const result = canUseFeature({
      user: null,
      feature: "free-sleeper-report",
    });

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("free");
    expect(result.requiredPlan).toBe("free");
  });

  it("documents the active monthly blueprint usage limit", () => {
    const result = canUseFeature({
      user: baseUser,
      feature: "monthly-roster-blueprint",
      leagueId: "123456789012345678",
    });

    expect(result.allowed).toBe(true);
    expect(result.usageLimit).toEqual({ period: "month", limit: 1 });
  });

  it("fails closed for paid features before billing is launched", () => {
    const result = canUseFeature({
      user: baseUser,
      feature: "source-trace-details",
      plan: "pro",
      paidFeaturesEnabled: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not launched/i);
  });

  it("allows paid features only when the launch flag and plan are present", () => {
    const result = canUseFeature({
      user: baseUser,
      feature: "source-trace-details",
      plan: "pro",
      paidFeaturesEnabled: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.requiredPlan).toBe("pro");
  });

  it("derives the highest active billing plan from subscription records", () => {
    const now = new Date("2026-06-02T12:00:00.000Z");

    expect(getUserBillingPlan(baseUser, null, [
      {
        plan: "pro",
        status: "active",
        currentPeriodEnd: "2026-07-02T12:00:00.000Z",
      },
      {
        plan: "elite",
        status: "trialing",
        currentPeriodEnd: "2026-06-15T12:00:00.000Z",
      },
    ], now)).toBe("elite");
  });

  it("ignores canceled or expired subscription records", () => {
    const now = new Date("2026-06-02T12:00:00.000Z");

    expect(getUserBillingPlan(baseUser, null, [
      {
        plan: "elite",
        status: "canceled",
        currentPeriodEnd: "2026-07-02T12:00:00.000Z",
      },
      {
        plan: "pro",
        status: "active",
        currentPeriodEnd: "2026-06-01T12:00:00.000Z",
      },
    ], now)).toBe("free");
  });

  it("does not allow subscription records to grant admin-plan access", () => {
    const now = new Date("2026-06-02T12:00:00.000Z");

    expect(getUserBillingPlan(baseUser, null, [
      {
        plan: "admin",
        status: "active",
        currentPeriodEnd: "2026-07-02T12:00:00.000Z",
      },
    ], now)).toBe("free");
  });

  it("allows paid features from active subscriptions only after billing launch is enabled", () => {
    const subscriptions = [{
      plan: "pro" as const,
      status: "active",
      currentPeriodEnd: "2026-07-02T12:00:00.000Z",
    }];

    expect(canUseFeature({
      user: baseUser,
      feature: "source-trace-details",
      subscriptions,
      paidFeaturesEnabled: false,
    }).allowed).toBe(false);

    expect(canUseFeature({
      user: baseUser,
      feature: "source-trace-details",
      subscriptions,
      paidFeaturesEnabled: true,
    }).allowed).toBe(true);
  });

  it("allows paid features from active persisted user entitlements after billing launch is enabled", () => {
    const entitlement = {
      subjectType: "user",
      userOpenId: "sample-user",
      leagueId: null,
      featureKey: "draft-kit-tools",
      status: "Active",
      expiresAt: null,
    };

    expect(canUseFeature({
      user: baseUser,
      feature: "draft-kit-tools",
      entitlements: [entitlement],
      paidFeaturesEnabled: false,
    }).allowed).toBe(false);

    const result = canUseFeature({
      user: baseUser,
      feature: "draft-kit-tools",
      entitlements: [entitlement],
      paidFeaturesEnabled: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("Allowed by persisted feature entitlement.");
  });

  it("allows paid features from matching active league entitlements only for that league", () => {
    const entitlements = [{
      subjectType: "league",
      userOpenId: null,
      leagueId: "123456789012345678",
      featureKey: "source-trace-details",
      status: "active",
      expiresAt: "2026-07-02T12:00:00.000Z",
    }];

    expect(canUseFeature({
      user: baseUser,
      feature: "source-trace-details",
      leagueId: "123456789012345678",
      entitlements,
      paidFeaturesEnabled: true,
    }).allowed).toBe(true);

    expect(canUseFeature({
      user: baseUser,
      feature: "source-trace-details",
      leagueId: "999999999999999999",
      entitlements,
      paidFeaturesEnabled: true,
    }).allowed).toBe(false);
  });

  it("ignores expired or inactive persisted entitlements", () => {
    expect(canUseFeature({
      user: baseUser,
      feature: "exports",
      entitlements: [
        {
          featureKey: "exports",
          status: "canceled",
          expiresAt: "2026-07-02T12:00:00.000Z",
        },
        {
          featureKey: "exports",
          status: "active",
          expiresAt: "2026-06-01T12:00:00.000Z",
        },
      ],
      paidFeaturesEnabled: true,
    }).allowed).toBe(false);
  });

  it("keeps paid feature access blocked below the required plan", () => {
    const result = canUseFeature({
      user: baseUser,
      feature: "anomaly-alerts",
      plan: "pro",
      paidFeaturesEnabled: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredPlan).toBe("elite");
  });

  it("treats role admins as admin-plan users for diagnostic-only features", () => {
    const adminUser = { ...baseUser, role: "admin" as const };

    expect(getUserBillingPlan(adminUser)).toBe("admin");
    expect(canUseFeature({
      user: adminUser,
      feature: "admin-diagnostics",
    }).allowed).toBe(true);
    expect(canUseFeature({
      user: baseUser,
      feature: "admin-diagnostics",
    }).allowed).toBe(false);
  });
});
