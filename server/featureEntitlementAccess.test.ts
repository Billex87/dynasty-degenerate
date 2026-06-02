import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import {
  listActiveFeatureEntitlementsForLeague,
  listActiveFeatureEntitlementsForUser,
  listActiveLeaguePassesForLeague,
  listBillingSubscriptionsForUser,
} from "./db";
import {
  canUsePersistedFeature,
  loadPersistedFeatureAccess,
} from "./featureEntitlements";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    listActiveFeatureEntitlementsForLeague: vi.fn(),
    listActiveFeatureEntitlementsForUser: vi.fn(),
    listActiveLeaguePassesForLeague: vi.fn(),
    listBillingSubscriptionsForUser: vi.fn(),
  };
});

const mockedListActiveFeatureEntitlementsForLeague = vi.mocked(listActiveFeatureEntitlementsForLeague);
const mockedListActiveFeatureEntitlementsForUser = vi.mocked(listActiveFeatureEntitlementsForUser);
const mockedListActiveLeaguePassesForLeague = vi.mocked(listActiveLeaguePassesForLeague);
const mockedListBillingSubscriptionsForUser = vi.mocked(listBillingSubscriptionsForUser);

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

describe("persisted feature access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListBillingSubscriptionsForUser.mockResolvedValue([]);
    mockedListActiveFeatureEntitlementsForUser.mockResolvedValue([]);
    mockedListActiveFeatureEntitlementsForLeague.mockResolvedValue([]);
    mockedListActiveLeaguePassesForLeague.mockResolvedValue([]);
  });

  it("loads subscriptions, user entitlements, league entitlements, and league passes", async () => {
    mockedListBillingSubscriptionsForUser.mockResolvedValue([{
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date("2026-07-02T00:00:00.000Z"),
    }]);
    mockedListActiveFeatureEntitlementsForUser.mockResolvedValue([{
      subjectType: "user",
      userOpenId: "email:user",
      leagueId: null,
      featureKey: "draft-kit-tools",
      plan: "one-time",
      status: "active",
      startsAt: null,
      expiresAt: null,
    }]);
    mockedListActiveFeatureEntitlementsForLeague.mockResolvedValue([{
      subjectType: "league",
      userOpenId: null,
      leagueId: "123456789012345678",
      featureKey: "source-trace-details",
      plan: "league-pass",
      status: "active",
      startsAt: null,
      expiresAt: null,
    }]);
    mockedListActiveLeaguePassesForLeague.mockResolvedValue([{
      leagueId: "123456789012345678",
      purchaserOpenId: "email:user",
      status: "active",
      startsAt: null,
      expiresAt: null,
      maxManagers: null,
    }]);

    const result = await loadPersistedFeatureAccess({
      user,
      leagueId: "123456789012345678",
    });

    expect(result.subscriptions).toHaveLength(1);
    expect(result.entitlements).toHaveLength(2);
    expect(result.leaguePasses).toHaveLength(1);
    expect(mockedListBillingSubscriptionsForUser).toHaveBeenCalledWith("email:user");
    expect(mockedListActiveFeatureEntitlementsForUser).toHaveBeenCalledWith("email:user");
    expect(mockedListActiveFeatureEntitlementsForLeague).toHaveBeenCalledWith("123456789012345678");
    expect(mockedListActiveLeaguePassesForLeague).toHaveBeenCalledWith("123456789012345678");
  });

  it("allows features from persisted DB entitlements", async () => {
    mockedListActiveFeatureEntitlementsForUser.mockResolvedValue([{
      subjectType: "user",
      userOpenId: "email:user",
      leagueId: null,
      featureKey: "draft-kit-tools",
      plan: "one-time",
      status: "active",
      startsAt: null,
      expiresAt: null,
    }]);

    const result = await canUsePersistedFeature({
      user,
      feature: "draft-kit-tools",
      paidFeaturesEnabled: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/persisted feature entitlement/i);
  });

  it("allows league-pass features from persisted DB league passes", async () => {
    mockedListActiveLeaguePassesForLeague.mockResolvedValue([{
      leagueId: "123456789012345678",
      purchaserOpenId: "email:user",
      status: "active",
      startsAt: null,
      expiresAt: null,
      maxManagers: null,
    }]);

    const result = await canUsePersistedFeature({
      user,
      feature: "exports",
      leagueId: "123456789012345678",
      paidFeaturesEnabled: true,
    });

    expect(result.allowed).toBe(true);
  });
});
