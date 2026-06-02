import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import {
  countUsageEvents,
  listActiveFeatureEntitlementsForLeague,
  listActiveFeatureEntitlementsForUser,
  listActiveLeaguePassesForLeague,
  listBillingSubscriptionsForUser,
  recordUsageEvent,
} from "./db";
import {
  assertAndRecordLimitedUsage,
  assertPersistedUsageLimit,
  checkPersistedUsageLimit,
  getPlanUsageLimit,
} from "./usageLimits";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    countUsageEvents: vi.fn(),
    listActiveFeatureEntitlementsForLeague: vi.fn(),
    listActiveFeatureEntitlementsForUser: vi.fn(),
    listActiveLeaguePassesForLeague: vi.fn(),
    listBillingSubscriptionsForUser: vi.fn(),
    recordUsageEvent: vi.fn(),
  };
});

const mockedCountUsageEvents = vi.mocked(countUsageEvents);
const mockedListActiveFeatureEntitlementsForLeague = vi.mocked(listActiveFeatureEntitlementsForLeague);
const mockedListActiveFeatureEntitlementsForUser = vi.mocked(listActiveFeatureEntitlementsForUser);
const mockedListActiveLeaguePassesForLeague = vi.mocked(listActiveLeaguePassesForLeague);
const mockedListBillingSubscriptionsForUser = vi.mocked(listBillingSubscriptionsForUser);
const mockedRecordUsageEvent = vi.mocked(recordUsageEvent);

const user: User = {
  id: 1,
  openId: "email:user",
  name: "Sample User",
  email: "sample@example.com",
  loginMethod: "magic-link",
  role: "user",
  createdAt: new Date("2026-06-02T00:00:00.000Z"),
  updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  lastSignedIn: new Date("2026-06-02T00:00:00.000Z"),
};

const now = new Date("2026-06-02T12:00:00.000Z");

describe("persisted usage limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCountUsageEvents.mockResolvedValue(0);
    mockedListActiveFeatureEntitlementsForLeague.mockResolvedValue([]);
    mockedListActiveFeatureEntitlementsForUser.mockResolvedValue([]);
    mockedListActiveLeaguePassesForLeague.mockResolvedValue([]);
    mockedListBillingSubscriptionsForUser.mockResolvedValue([]);
    mockedRecordUsageEvent.mockResolvedValue(true);
  });

  it("documents tier limits for report generation and paid usage surfaces", () => {
    expect(getPlanUsageLimit({ featureKey: "report-generation", plan: "free" })).toBe(1);
    expect(getPlanUsageLimit({ featureKey: "report-generation", plan: "pro" })).toBeNull();
    expect(getPlanUsageLimit({ featureKey: "saved-league", plan: "free" })).toBe(1);
    expect(getPlanUsageLimit({ featureKey: "export", plan: "pro" })).toBe(10);
    expect(getPlanUsageLimit({ featureKey: "anomaly-alert", plan: "elite" })).toBe(100);
  });

  it("allows a free user's first daily report and blocks the second", async () => {
    mockedCountUsageEvents.mockResolvedValueOnce(0);

    await expect(checkPersistedUsageLimit({
      user,
      featureKey: "report-generation",
      now,
    })).resolves.toMatchObject({
      allowed: true,
      limit: 1,
      used: 0,
      remaining: 0,
      usageKey: "report-generation:day:2026-06-02",
    });

    mockedCountUsageEvents.mockResolvedValueOnce(1);

    await expect(assertPersistedUsageLimit({
      user,
      featureKey: "report-generation",
      now,
    })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("treats active pro subscriptions as unlimited daily report access", async () => {
    mockedListBillingSubscriptionsForUser.mockResolvedValue([{
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date("2026-07-02T00:00:00.000Z"),
    }]);

    await expect(checkPersistedUsageLimit({
      user,
      featureKey: "report-generation",
      now,
    })).resolves.toMatchObject({
      allowed: true,
      effectivePlan: "pro",
      limit: null,
      remaining: null,
    });
    expect(mockedCountUsageEvents).not.toHaveBeenCalled();
  });

  it("blocks paid usage surfaces without a matching plan or entitlement", async () => {
    await expect(assertPersistedUsageLimit({
      user,
      featureKey: "export",
      leagueId: "123456789012345678",
      paidFeaturesEnabled: true,
      now,
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockedCountUsageEvents).not.toHaveBeenCalled();
  });

  it("requires a signed-in user for user-scoped persisted limits", async () => {
    await expect(assertPersistedUsageLimit({
      user: null,
      featureKey: "saved-report",
      now,
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockedCountUsageEvents).not.toHaveBeenCalled();
  });

  it("requires a league ID for league-scoped persisted limits", async () => {
    await expect(assertPersistedUsageLimit({
      user,
      featureKey: "source-trace-view",
      paidFeaturesEnabled: true,
      now,
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockedCountUsageEvents).not.toHaveBeenCalled();
  });

  it("applies pro quotas when a league pass grants export access", async () => {
    mockedListActiveLeaguePassesForLeague.mockResolvedValue([{
      leagueId: "123456789012345678",
      purchaserOpenId: "email:user",
      status: "active",
      startsAt: null,
      expiresAt: null,
      maxManagers: null,
      metadata: null,
    }]);
    mockedCountUsageEvents.mockResolvedValueOnce(9);

    await expect(checkPersistedUsageLimit({
      user,
      featureKey: "export",
      leagueId: "123456789012345678",
      paidFeaturesEnabled: true,
      now,
    })).resolves.toMatchObject({
      allowed: true,
      plan: "free",
      effectivePlan: "pro",
      limit: 10,
      used: 9,
      remaining: 0,
    });
  });

  it("records limited usage with scoped, idempotent event keys", async () => {
    await expect(assertAndRecordLimitedUsage({
      user,
      featureKey: "saved-report",
      source: "account-router",
      idempotencyKey: "report:abc",
      metadata: { reportId: "abc" },
      now,
    })).resolves.toMatchObject({
      recorded: true,
      limit: {
        allowed: true,
        usageKey: "saved-report:month:2026-06-01",
      },
    });

    expect(mockedRecordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      leagueId: null,
      featureKey: "saved-report",
      usageKey: "saved-report:month:2026-06-01",
      source: "account-router",
      metadata: { reportId: "abc" },
    }));
  });

  it("does not record usage when the limit check fails", async () => {
    mockedCountUsageEvents.mockResolvedValueOnce(1);

    await expect(assertAndRecordLimitedUsage({
      user,
      featureKey: "saved-report",
      source: "account-router",
      idempotencyKey: "report:abc",
      now,
    })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(mockedRecordUsageEvent).not.toHaveBeenCalled();
  });
});
