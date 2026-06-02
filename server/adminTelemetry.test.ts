import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
const originalDatabaseUrl = process.env.DATABASE_URL;

function createContext(user: Partial<AuthenticatedUser> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sample-user",
      email: "sample@example.com",
      name: "Sample User",
      loginMethod: "admin-passphrase",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...user,
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("system.abuseTelemetry", () => {
  afterEach(() => {
    delete process.env.ADMIN_PERMISSIONS;
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("allows users configured with admin permissions", async () => {
    process.env.ADMIN_PERMISSIONS = "mynameisbillex";
    const caller = appRouter.createCaller(createContext({
      openId: "mynameisbillex",
      name: "mynameisbillex",
    }));

    const result = await caller.system.abuseTelemetry({ lookbackDays: 1 });

    expect(result.lookbackDays).toBe(1);
    expect(result.totals.events).toBeGreaterThanOrEqual(0);
  });

  it("allows the default trusted Sleeper admin list", async () => {
    const caller = appRouter.createCaller(createContext({
      openId: "AwwQQ",
      name: "AwwQQ",
    }));

    const result = await caller.system.abuseTelemetry({ lookbackDays: 1 });

    expect(result.lookbackDays).toBe(1);
  });

  it("blocks authenticated users outside the admin permission list", async () => {
    const caller = appRouter.createCaller(createContext({
      openId: "regular-user",
      email: "regular@example.com",
      name: "Regular User",
    }));

    await expect(caller.system.abuseTelemetry({ lookbackDays: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows admins to mark AI prediction outcomes manually", async () => {
    process.env.ADMIN_PERMISSIONS = "mynameisbillex";
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext({
      openId: "mynameisbillex",
      name: "mynameisbillex",
    }));

    const result = await caller.system.markAiPredictionOutcome({
      eventId: "missing-event",
      status: "push",
      note: "Ignored in test.",
    });

    expect(result).toEqual({ persisted: false });
  });

  it("exposes an admin-only billing overview without database persistence", async () => {
    process.env.ADMIN_PERMISSIONS = "mynameisbillex";
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext({
      openId: "mynameisbillex",
      name: "mynameisbillex",
    }));

    const result = await caller.system.billingOverview({ lookbackDays: 30 });

    expect(result.lookbackDays).toBe(30);
    expect(result.usageSince).toMatch(/T/);
    expect(result.totals).toMatchObject({
      billingCustomers: 0,
      subscriptions: 0,
      failedPaymentSubscriptions: 0,
      activeLeaguePasses: 0,
      entitlementOverrides: 0,
      usageEvents: 0,
    });
    expect(result.recentSubscriptions).toEqual([]);
  });
});
