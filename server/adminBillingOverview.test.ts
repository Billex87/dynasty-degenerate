import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const neonMocks = vi.hoisted(() => ({
  sql: vi.fn(),
  neon: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: neonMocks.neon,
}));

const originalDatabaseUrl = process.env.DATABASE_URL;

function getSqlText(strings: TemplateStringsArray): string {
  return Array.from(strings).join(" ");
}

describe("admin billing overview SQL mapping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://billing-overview.test";
    neonMocks.neon.mockReturnValue(neonMocks.sql);
    neonMocks.sql.mockImplementation(async (strings: TemplateStringsArray) => {
      const text = getSqlText(strings);

      if (text.includes('FROM "billingCustomers"')) {
        return [{ total: "4", active: "3" }];
      }
      if (text.includes("FROM subscriptions") && text.includes("FILTER")) {
        return [{ total: "5", active: "2", failed: "1" }];
      }
      if (text.includes('FROM "leaguePasses"') && text.includes("FILTER")) {
        return [{ total: "3", active: "2" }];
      }
      if (text.includes('FROM "featureEntitlements"') && text.includes("overrides")) {
        return [{ total: "6", active: "4", overrides: "2" }];
      }
      if (text.includes('FROM "usageEvents"') && text.includes("COUNT(*)::int AS total")) {
        return [{ total: "9" }];
      }
      if (text.includes("FROM subscriptions") && text.includes("GROUP BY plan, status")) {
        return [
          { plan: "pro", status: "active", count: "2" },
          { plan: "elite", status: "past_due", count: "1" },
        ];
      }
      if (text.includes('FROM "leaguePasses"') && text.includes("GROUP BY status")) {
        return [
          { label: "active", count: "2" },
          { label: "canceled", count: "1" },
        ];
      }
      if (text.includes('FROM "featureEntitlements"') && text.includes('GROUP BY "featureKey"')) {
        return [
          { label: "source-trace-details", count: "3" },
          { label: "exports", count: "1" },
        ];
      }
      if (text.includes('FROM "usageEvents"') && text.includes('GROUP BY "featureKey"')) {
        return [
          { featureKey: "report-generation", quantity: "8" },
          { featureKey: "export", quantity: "1" },
        ];
      }
      if (text.includes("FROM subscriptions") && text.includes('ORDER BY "updatedAt" DESC')) {
        return [{
          userOpenId: "email:user",
          plan: "pro",
          status: "active",
          currentPeriodEnd: "2026-07-02T00:00:00.000Z",
          updatedAt: "2026-06-02T00:00:00.000Z",
        }];
      }

      return [];
    });
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("maps billing, entitlement, failed-payment, and usage aggregates", async () => {
    const { getAdminBillingOverview } = await import("./db");

    const overview = await getAdminBillingOverview({
      usageSince: "2026-06-01T00:00:00.000Z",
      limit: 2,
    });

    expect(neonMocks.neon).toHaveBeenCalledWith("postgres://billing-overview.test");
    expect(overview.totals).toEqual({
      billingCustomers: 4,
      activeBillingCustomers: 3,
      subscriptions: 5,
      activeSubscriptions: 2,
      failedPaymentSubscriptions: 1,
      leaguePasses: 3,
      activeLeaguePasses: 2,
      featureEntitlements: 6,
      activeFeatureEntitlements: 4,
      entitlementOverrides: 2,
      usageEvents: 9,
    });
    expect(overview.subscriptionsByPlanStatus).toEqual([
      { plan: "pro", status: "active", count: 2 },
      { plan: "elite", status: "past_due", count: 1 },
    ]);
    expect(overview.leaguePassesByStatus).toEqual([
      { label: "active", count: 2 },
      { label: "canceled", count: 1 },
    ]);
    expect(overview.entitlementsByFeature).toEqual([
      { label: "source-trace-details", count: 3 },
      { label: "exports", count: 1 },
    ]);
    expect(overview.usageByFeature).toEqual([
      { featureKey: "report-generation", quantity: 8 },
      { featureKey: "export", quantity: 1 },
    ]);
    expect(overview.recentSubscriptions).toEqual([{
      userOpenId: "email:user",
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date("2026-07-02T00:00:00.000Z"),
      updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    }]);
  });
});
