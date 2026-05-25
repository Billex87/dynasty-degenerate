import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const originalDatabaseUrl = process.env.DATABASE_URL;

function createContext(user: Partial<AuthenticatedUser> | null = {}): TrpcContext {
  return {
    user: user === null ? null : {
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

describe("actionPlans router", () => {
  afterEach(() => {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.actionPlans.list({ leagueId: "13000000000000" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("keeps legacy action plans read-only when the database is unavailable", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    const result = await caller.actionPlans.list({
      leagueId: "13000000000000",
    });

    expect(result.plans).toEqual([]);
  });

  it("keeps legacy waiver bid history read-only when the database is unavailable", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    const result = await caller.actionPlans.listWaiverBidHistory({
      leagueId: "13000000000000",
    });

    expect(result.bidHistory).toEqual([]);
  });
});
