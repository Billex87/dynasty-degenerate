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
