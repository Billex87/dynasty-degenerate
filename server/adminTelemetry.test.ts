import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

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
});
