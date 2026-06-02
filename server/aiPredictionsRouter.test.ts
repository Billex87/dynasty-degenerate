import fs from "fs";
import path from "path";
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

function predictionEvent() {
  return {
    schemaVersion: 1 as const,
    eventId: "ai-test-event",
    predictionKey: "waiver:pickup:13000000000000:tester:player:p1:2026:1",
    createdAt: "2026-09-01T00:00:00.000Z",
    surface: "waiver" as const,
    action: "pickup" as const,
    decision: "do" as const,
    entityType: "player" as const,
    entityId: "p1",
    entityName: "Waiver Receiver",
    leagueId: "13000000000000",
    manager: "Tester",
    season: "2026",
    week: 1,
    label: "priority" as const,
    finalScore: 78,
    confidenceCap: 100,
    evidence: ["League roster snapshot shows this player is available."],
    missingEvidence: [],
    hardBlockers: [],
    softPenalties: [],
    sourceTrace: [{ label: "Sleeper roster snapshot", status: "loaded" as const }],
    sourceAgreement: {
      state: "aligned" as const,
      directionalSourceCount: 1,
      sourceCount: 1,
      forWeight: 80,
      againstWeight: 0,
      neutralWeight: 0,
      missingCount: 0,
      confidenceCap: null,
      reason: "Directional sources align.",
      signals: [{
        source: "Sleeper roster snapshot",
        direction: "for" as const,
        confidence: 80,
        status: "loaded" as const,
        detail: "Available in live roster snapshot.",
      }],
    },
    whyThisFired: "Waiver read fired with enough evidence.",
    outcome: { status: "pending" as const },
    metadata: { source: "test" },
  };
}

describe("aiPredictions router", () => {
  afterEach(() => {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.aiPredictions.list({ leagueId: "13000000000000" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("accepts typed prediction events when the database is unavailable", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    const result = await caller.aiPredictions.upsertMany({
      events: [predictionEvent()],
    });

    expect(result).toEqual({
      accepted: 1,
      persisted: 0,
    });
  });

  it("rejects oversized prediction event payloads before persistence", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    await expect(caller.aiPredictions.upsertMany({
      events: [{
        ...predictionEvent(),
        eventId: "ai-huge-event",
        metadata: {
          source: "test",
          oversized: "x".repeat(70_000),
        },
      }],
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects unbounded source-agreement payloads", async () => {
    delete process.env.DATABASE_URL;
    const caller = appRouter.createCaller(createContext());

    await expect(caller.aiPredictions.upsertMany({
      events: [{
        ...predictionEvent(),
        eventId: "ai-invalid-source-agreement",
        sourceAgreement: {
          state: "aligned",
          directionalSourceCount: 1,
          sourceCount: 1,
          forWeight: 80,
          againstWeight: 0,
          neutralWeight: 0,
          missingCount: 0,
          confidenceCap: null,
          reason: "Directional sources align.",
          signals: Array.from({ length: 13 }, (_, index) => ({
            source: `source-${index}`,
            direction: "for",
            confidence: 80,
            status: "loaded",
            detail: "loaded",
          })),
        },
      }],
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("keeps prediction history routes behind route-level rate limits", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "server/routers.ts"), "utf8");
    const routeStart = source.indexOf("aiPredictions: router({");
    const routeEnd = source.indexOf("\n\n  league: router({", routeStart);
    const routeSource = source.slice(routeStart, routeEnd);

    expect(routeSource).toContain("assertRateLimit(ctx.req as any");
    expect(routeSource).toContain('id: "aiPredictions.upsertMany"');
    expect(routeSource).toContain('id: "aiPredictions.list"');
    expect(routeSource).toContain('id: "aiPredictions.updateOutcome"');
    expect(routeSource).toContain("scope: userKey");
  });
});
