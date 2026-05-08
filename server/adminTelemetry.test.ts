import { describe, expect, it } from "vitest";
import { PRIVILEGED_REPORT_VIEWERS } from "../shared/const";
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
      loginMethod: "manus",
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
  it("allows users listed in PRIVILEGED_REPORT_VIEWERS", async () => {
    const caller = appRouter.createCaller(createContext({
      openId: PRIVILEGED_REPORT_VIEWERS[0],
      name: PRIVILEGED_REPORT_VIEWERS[0],
    }));

    const result = await caller.system.abuseTelemetry({ lookbackDays: 1 });

    expect(result.lookbackDays).toBe(1);
    expect(result.totals.events).toBeGreaterThanOrEqual(0);
  });

  it("blocks authenticated users outside the privileged report viewer list", async () => {
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
