import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const originalDatabaseUrl = process.env.DATABASE_URL;
const routersSource = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf8");

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

  it("rejects invalid league IDs before legacy action-plan DB reads", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    await expect(caller.actionPlans.list({
      leagueId: "not-a-sleeper-league",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.actionPlans.listWaiverBidHistory({
      leagueId: "not-a-sleeper-league",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("keeps action-plan DB reads behind route-level rate limits", () => {
    const start = routersSource.indexOf("actionPlans: router({");
    const end = routersSource.indexOf("\n\n  aiPredictions: router({", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const routeSource = routersSource.slice(start, end);
    const plansRateLimitIndex = routeSource.indexOf('id: "actionPlans.list"');
    const plansReadIndex = routeSource.indexOf("listActionPlans({");
    const bidHistoryRateLimitIndex = routeSource.indexOf('id: "actionPlans.listWaiverBidHistory"');
    const bidHistoryReadIndex = routeSource.indexOf("listWaiverBidHistory({");

    expect(plansRateLimitIndex).toBeGreaterThan(0);
    expect(plansReadIndex).toBeGreaterThan(plansRateLimitIndex);
    expect(bidHistoryRateLimitIndex).toBeGreaterThan(0);
    expect(bidHistoryReadIndex).toBeGreaterThan(bidHistoryRateLimitIndex);
    expect(routeSource).toContain("assertRateLimit(ctx.req as any");
    expect(routeSource).toContain("scope: userKey");
    expect(routeSource).toContain('clientKey: "authenticated-user"');
    expect(routeSource).toContain("leagueId: sleeperLeagueIdSchema.optional()");
  });
});
