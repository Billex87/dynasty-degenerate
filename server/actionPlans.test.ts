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

  it("accepts typed action plans when the database is unavailable", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    const result = await caller.actionPlans.upsert({
      plan: {
        id: "lineup:13000000000000:sample:starter:bench",
        kind: "lineup",
        leagueId: "13000000000000",
        manager: "Sample Manager",
        playerId: "starter",
        replacementPlayerId: "bench",
        createdAt: Date.parse("2026-05-11T12:00:00.000Z"),
        title: "Starter -> Bench",
        summary: "Bench has the better projection.",
        status: "saved",
        payload: {
          starterOut: { playerId: "starter" },
          replacements: [{ playerId: "bench", confidencePct: 76 }],
        },
      },
    });

    expect(result.persisted).toBe(false);
    expect(result.plan.kind).toBe("lineup");
    expect(result.plan.replacementPlayerId).toBe("bench");
  });

  it("accepts observed trade recommendation outcomes when the database is unavailable", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    const result = await caller.actionPlans.upsert({
      plan: {
        id: "trade:13000000000000:sample:rival:wr1",
        kind: "trade",
        leagueId: "13000000000000",
        manager: "Sample Manager",
        playerId: "wr1",
        createdAt: Date.parse("2026-05-11T12:00:00.000Z"),
        title: "Trade read: Rival",
        summary: "Rival is a fit, but has declined this player before.",
        status: "blocked",
        payload: {
          sourceManager: "Sample Manager",
          targetManager: "Rival",
          targetPlayerId: "wr1",
          outcomeStatus: "blocked",
        },
      },
    });

    expect(result.persisted).toBe(false);
    expect(result.plan.kind).toBe("trade");
    expect(result.plan.status).toBe("blocked");
  });

  it("accepts typed waiver bid history when the database is unavailable", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    const result = await caller.actionPlans.upsertWaiverBidHistory({
      item: {
        id: "waiver-bid:13000000000000:sample:wr1",
        leagueId: "13000000000000",
        manager: "Sample Manager",
        playerId: "wr1",
        playerName: "Waiver Receiver",
        position: "WR",
        bidMin: 7,
        bidMax: 12,
        bidLabel: "FAAB 7-12",
        source: "submitted-plan",
        createdAt: Date.parse("2026-05-11T12:00:00.000Z"),
      },
    });

    expect(result.persisted).toBe(false);
    expect(result.item.playerName).toBe("Waiver Receiver");
  });
});
