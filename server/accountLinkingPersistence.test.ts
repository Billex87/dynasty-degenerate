import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteUserFavoriteLeague,
  deleteUserSleeperAccount,
  getUserNotificationPreferences,
  listUserFavoriteLeagues,
  listUserRecentReports,
  listUserSleeperAccounts,
  recordUserRecentReport,
  upsertUserFavoriteLeague,
  upsertUserNotificationPreferences,
  upsertUserSleeperAccount,
} from "./db";

describe("account linking persistence helpers", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("fails safely when account-linking persistence has no database", async () => {
    await expect(upsertUserSleeperAccount({
      userOpenId: "email:user",
      sleeperUserId: "123456789012345678",
      sleeperUsername: "MySleeper",
      isPrimary: true,
    })).resolves.toBe(false);

    await expect(upsertUserFavoriteLeague({
      userOpenId: "email:user",
      leagueId: "123456789012345678",
      leagueName: "Skids Get Beat",
    })).resolves.toBe(false);

    await expect(recordUserRecentReport({
      userOpenId: "email:user",
      leagueId: "123456789012345678",
      leagueName: "Skids Get Beat",
      sleeperUsername: "MySleeper",
    })).resolves.toBe(false);

    await expect(upsertUserNotificationPreferences({
      userOpenId: "email:user",
      billingEmails: true,
      productEmails: false,
      reportAlerts: true,
      anomalyAlerts: false,
      weeklyDigest: true,
    })).resolves.toBe(false);
  });

  it("fails safely when account-linking reads have no database", async () => {
    await expect(listUserSleeperAccounts("email:user")).resolves.toEqual([]);
    await expect(listUserFavoriteLeagues("email:user")).resolves.toEqual([]);
    await expect(listUserRecentReports("email:user")).resolves.toEqual([]);
    await expect(getUserNotificationPreferences("email:user")).resolves.toEqual({
      billingEmails: true,
      productEmails: true,
      reportAlerts: false,
      anomalyAlerts: false,
      weeklyDigest: false,
      updatedAt: null,
    });
  });

  it("fails safely when account-linking deletes have no database", async () => {
    await expect(deleteUserSleeperAccount({
      userOpenId: "email:user",
      sleeperUserId: "123456789012345678",
    })).resolves.toBe(false);

    await expect(deleteUserFavoriteLeague({
      userOpenId: "email:user",
      leagueId: "123456789012345678",
    })).resolves.toBe(false);
  });

  it("validates required identifiers before attempting account-linking work", async () => {
    await expect(upsertUserSleeperAccount({
      userOpenId: "",
      sleeperUserId: "123456789012345678",
      sleeperUsername: "mynameisbillex",
    })).rejects.toThrow(/userOpenId is required/);

    await expect(upsertUserFavoriteLeague({
      userOpenId: "email:user",
      leagueId: "",
    })).rejects.toThrow(/leagueId is required/);

    await expect(recordUserRecentReport({
      userOpenId: "email:user",
      leagueId: "",
    })).rejects.toThrow(/leagueId is required/);

    await expect(upsertUserNotificationPreferences({
      userOpenId: "",
    })).rejects.toThrow(/userOpenId is required/);
  });
});
