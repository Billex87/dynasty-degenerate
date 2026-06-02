import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  deleteUserFavoriteLeague,
  deleteUserSleeperAccount,
  getUserNotificationPreferences,
  listActiveFeatureEntitlementsForLeague,
  listActiveFeatureEntitlementsForUser,
  listActiveLeaguePassesForLeague,
  listBillingSubscriptionsForUser,
  listUserFavoriteLeagues,
  listUserRecentReports,
  listUserSleeperAccounts,
  recordUserRecentReport,
  upsertUserFavoriteLeague,
  upsertUserNotificationPreferences,
  upsertUserSleeperAccount,
} from "./db";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    deleteUserFavoriteLeague: vi.fn(),
    deleteUserSleeperAccount: vi.fn(),
    getUserNotificationPreferences: vi.fn(),
    listActiveFeatureEntitlementsForLeague: vi.fn(),
    listActiveFeatureEntitlementsForUser: vi.fn(),
    listActiveLeaguePassesForLeague: vi.fn(),
    listBillingSubscriptionsForUser: vi.fn(),
    listUserFavoriteLeagues: vi.fn(),
    listUserRecentReports: vi.fn(),
    listUserSleeperAccounts: vi.fn(),
    recordUserRecentReport: vi.fn(),
    upsertUserFavoriteLeague: vi.fn(),
    upsertUserNotificationPreferences: vi.fn(),
    upsertUserSleeperAccount: vi.fn(),
  };
});

const mockedDeleteUserFavoriteLeague = vi.mocked(deleteUserFavoriteLeague);
const mockedDeleteUserSleeperAccount = vi.mocked(deleteUserSleeperAccount);
const mockedGetUserNotificationPreferences = vi.mocked(getUserNotificationPreferences);
const mockedListActiveFeatureEntitlementsForLeague = vi.mocked(listActiveFeatureEntitlementsForLeague);
const mockedListActiveFeatureEntitlementsForUser = vi.mocked(listActiveFeatureEntitlementsForUser);
const mockedListActiveLeaguePassesForLeague = vi.mocked(listActiveLeaguePassesForLeague);
const mockedListBillingSubscriptionsForUser = vi.mocked(listBillingSubscriptionsForUser);
const mockedListUserFavoriteLeagues = vi.mocked(listUserFavoriteLeagues);
const mockedListUserRecentReports = vi.mocked(listUserRecentReports);
const mockedListUserSleeperAccounts = vi.mocked(listUserSleeperAccounts);
const mockedRecordUserRecentReport = vi.mocked(recordUserRecentReport);
const mockedUpsertUserFavoriteLeague = vi.mocked(upsertUserFavoriteLeague);
const mockedUpsertUserNotificationPreferences = vi.mocked(upsertUserNotificationPreferences);
const mockedUpsertUserSleeperAccount = vi.mocked(upsertUserSleeperAccount);

const user: User = {
  id: 42,
  openId: "email:user",
  name: "Sample User",
  email: "user@example.com",
  loginMethod: "magic-link",
  role: "user",
  createdAt: new Date("2026-06-02T12:00:00.000Z"),
  updatedAt: new Date("2026-06-02T12:00:00.000Z"),
  lastSignedIn: new Date("2026-06-02T12:00:00.000Z"),
};

function createContext(currentUser: User | null = user): TrpcContext {
  return {
    user: currentUser,
    req: {
      protocol: "https",
      ip: "192.0.2.44",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("account router", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    vi.clearAllMocks();
    mockedListUserSleeperAccounts.mockResolvedValue([{
      sleeperUserId: "123456789012345678",
      sleeperUsername: "mynameisbillex",
      displayName: "Billy",
      avatar: null,
      isPrimary: true,
      updatedAt: new Date("2026-06-02T12:00:00.000Z"),
    }]);
    mockedListUserFavoriteLeagues.mockResolvedValue([{
      leagueId: "1312139584427012096",
      leagueName: "Skids Get Beat",
      platform: "sleeper",
      sleeperUserId: "123456789012345678",
      updatedAt: new Date("2026-06-02T12:00:00.000Z"),
    }]);
    mockedListUserRecentReports.mockResolvedValue([]);
    mockedGetUserNotificationPreferences.mockResolvedValue({
      billingEmails: true,
      productEmails: true,
      reportAlerts: false,
      anomalyAlerts: false,
      weeklyDigest: false,
      updatedAt: null,
    });
    mockedListActiveFeatureEntitlementsForLeague.mockResolvedValue([]);
    mockedListActiveFeatureEntitlementsForUser.mockResolvedValue([]);
    mockedListActiveLeaguePassesForLeague.mockResolvedValue([]);
    mockedListBillingSubscriptionsForUser.mockResolvedValue([]);
    mockedUpsertUserSleeperAccount.mockResolvedValue(true);
    mockedDeleteUserSleeperAccount.mockResolvedValue(true);
    mockedUpsertUserFavoriteLeague.mockResolvedValue(true);
    mockedDeleteUserFavoriteLeague.mockResolvedValue(true);
    mockedRecordUserRecentReport.mockResolvedValue(true);
    mockedUpsertUserNotificationPreferences.mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("requires auth for account links", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.account.links()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns account-linked usernames, favorite leagues, recent reports, and preferences", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.account.links()).resolves.toMatchObject({
      sleeperAccounts: [{
        sleeperUserId: "123456789012345678",
        sleeperUsername: "mynameisbillex",
        isPrimary: true,
      }],
      favoriteLeagues: [{
        leagueId: "1312139584427012096",
        leagueName: "Skids Get Beat",
      }],
      recentReports: [],
      notificationPreferences: {
        billingEmails: true,
        productEmails: true,
      },
    });
    expect(mockedListUserSleeperAccounts).toHaveBeenCalledWith("email:user");
    expect(mockedListUserFavoriteLeagues).toHaveBeenCalledWith("email:user");
    expect(mockedListUserRecentReports).toHaveBeenCalledWith("email:user");
    expect(mockedGetUserNotificationPreferences).toHaveBeenCalledWith("email:user");
  });

  it("saves owned Sleeper accounts without accepting userOpenId from the client", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.account.saveSleeperAccount({
      sleeperUserId: "123456789012345678",
      sleeperUsername: "MyNameIsBillEx",
      displayName: "Billy",
      isPrimary: true,
    })).resolves.toEqual({ success: true });

    expect(mockedUpsertUserSleeperAccount).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      sleeperUserId: "123456789012345678",
      sleeperUsername: "MyNameIsBillEx",
      displayName: "Billy",
      isPrimary: true,
    }));
  });

  it("saves favorite leagues and recent reports for the signed-in user", async () => {
    const caller = appRouter.createCaller(createContext());

    await caller.account.saveFavoriteLeague({
      leagueId: "1312139584427012096",
      leagueName: "Skids Get Beat",
      sleeperUserId: "123456789012345678",
    });
    await caller.account.recordRecentReport({
      leagueId: "1312139584427012096",
      leagueName: "Skids Get Beat",
      sleeperUsername: "mynameisbillex",
      sleeperUserId: "123456789012345678",
    });

    expect(mockedUpsertUserFavoriteLeague).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      leagueId: "1312139584427012096",
      platform: "sleeper",
    }));
    expect(mockedRecordUserRecentReport).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      leagueId: "1312139584427012096",
      platform: "sleeper",
    }));
  });

  it("blocks new saved leagues and reports when the free account cap is reached", async () => {
    mockedListUserRecentReports.mockResolvedValueOnce([{
      leagueId: "1312139584427012096",
      leagueName: "Skids Get Beat",
      sleeperUsername: "mynameisbillex",
      sleeperUserId: "123456789012345678",
      platform: "sleeper",
      lastViewedAt: new Date("2026-06-02T12:00:00.000Z"),
    }]);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.account.saveFavoriteLeague({
      leagueId: "999999999999999999",
      leagueName: "New League",
    })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    await expect(caller.account.recordRecentReport({
      leagueId: "999999999999999999",
      leagueName: "New League",
    })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    expect(mockedUpsertUserFavoriteLeague).not.toHaveBeenCalled();
    expect(mockedRecordUserRecentReport).not.toHaveBeenCalled();
  });

  it("allows active pro users to save beyond the free account caps", async () => {
    mockedListBillingSubscriptionsForUser.mockResolvedValue([{
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date("2026-07-02T00:00:00.000Z"),
    }]);
    mockedListUserRecentReports.mockResolvedValueOnce([{
      leagueId: "1312139584427012096",
      leagueName: "Skids Get Beat",
      sleeperUsername: "mynameisbillex",
      sleeperUserId: "123456789012345678",
      platform: "sleeper",
      lastViewedAt: new Date("2026-06-02T12:00:00.000Z"),
    }]);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.account.saveFavoriteLeague({
      leagueId: "999999999999999999",
      leagueName: "New League",
    })).resolves.toEqual({ success: true });
    await expect(caller.account.recordRecentReport({
      leagueId: "999999999999999999",
      leagueName: "New League",
    })).resolves.toEqual({ success: true });

    expect(mockedUpsertUserFavoriteLeague).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      leagueId: "999999999999999999",
    }));
    expect(mockedRecordUserRecentReport).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      leagueId: "999999999999999999",
    }));
  });

  it("updates notification preferences for the signed-in user", async () => {
    const caller = appRouter.createCaller(createContext());

    await caller.account.updateNotificationPreferences({
      billingEmails: true,
      productEmails: false,
      reportAlerts: true,
      anomalyAlerts: true,
      weeklyDigest: false,
    });

    expect(mockedUpsertUserNotificationPreferences).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      billingEmails: true,
      productEmails: false,
      reportAlerts: true,
      anomalyAlerts: true,
      weeklyDigest: false,
    }));
  });

  it("fails writes when persistence is unavailable", async () => {
    mockedUpsertUserFavoriteLeague.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.account.saveFavoriteLeague({
      leagueId: "1312139584427012096",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Account linking requires database availability.",
    });
  });

  it("deletes only signed-in user account-link records", async () => {
    const caller = appRouter.createCaller(createContext());

    await caller.account.removeSleeperAccount({
      sleeperUserId: "123456789012345678",
    });
    await caller.account.removeFavoriteLeague({
      leagueId: "1312139584427012096",
    });

    expect(mockedDeleteUserSleeperAccount).toHaveBeenCalledWith({
      userOpenId: "email:user",
      sleeperUserId: "123456789012345678",
    });
    expect(mockedDeleteUserFavoriteLeague).toHaveBeenCalledWith({
      userOpenId: "email:user",
      leagueId: "1312139584427012096",
    });
  });
});
