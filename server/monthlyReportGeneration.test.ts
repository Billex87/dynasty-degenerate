import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const reserveMonthlyReportGeneration = vi.fn();

vi.mock("./db", () => ({
  findLeagueReportCache: vi.fn(),
  getLoginAttemptsSince: vi.fn(),
  insertLoginAttempt: vi.fn(),
  listLeagueAiConfidenceSnapshots: vi.fn(() => Promise.resolve([])),
  listLatestSnapshotMetadata: vi.fn(() => Promise.resolve([])),
  listSourceHealthEventsSince: vi.fn(() => Promise.resolve([])),
  reserveMonthlyReportGeneration,
  insertSourceHealthEvents: vi.fn(),
  upsertLeagueAiConfidenceSnapshot: vi.fn(),
  upsertLeagueReportCache: vi.fn(),
  upsertMonthlyRosterBlueprintSnapshots: vi.fn(),
  upsertUser: vi.fn(),
}));

const { assertMonthlyReportGenerationAllowed } = await import("./routers");

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: Partial<AuthenticatedUser> | null = {}): TrpcContext {
  return {
    user: user === null
      ? null
      : {
          id: 1,
          openId: "sample-user",
          email: "sample@example.com",
          name: "Sample User",
          loginMethod: "sleeper",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          ...user,
        },
    req: {
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("monthly report generation quota", () => {
  beforeEach(() => {
    reserveMonthlyReportGeneration.mockReset();
  });

  afterEach(() => {
    delete process.env.ADMIN_PERMISSIONS;
  });

  it("reserves one monthly generation for regular users", async () => {
    reserveMonthlyReportGeneration.mockResolvedValueOnce({
      allowed: true,
      userKey: "auth:sample-user",
      snapshotMonth: "2026-05",
      existing: null,
    });

    await expect(assertMonthlyReportGenerationAllowed({
      ctx: createContext(),
      leagueId: "123456789012345678",
      viewerUserId: "222222222222222222",
      ipAddress: "203.0.113.10",
    })).resolves.toBeUndefined();

    expect(reserveMonthlyReportGeneration).toHaveBeenCalledTimes(1);
    expect(reserveMonthlyReportGeneration).toHaveBeenCalledWith(expect.objectContaining({
      leagueId: "123456789012345678",
      userKey: "auth:sample-user",
    }));
  });

  it("blocks another monthly blueprint after the user's monthly generation is used", async () => {
    reserveMonthlyReportGeneration.mockResolvedValueOnce({
      allowed: false,
      userKey: "auth:sample-user",
      snapshotMonth: "2026-05",
      existing: {
        leagueId: "123456789012345678",
        createdAt: new Date(),
      },
    });

    await expect(assertMonthlyReportGenerationAllowed({
      ctx: createContext(),
      leagueId: "999999999999999999",
      viewerUserId: "222222222222222222",
      ipAddress: "203.0.113.10",
    })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("allows the same monthly blueprint to be regenerated for the original league", async () => {
    reserveMonthlyReportGeneration.mockResolvedValueOnce({
      allowed: false,
      userKey: "auth:sample-user",
      snapshotMonth: "2026-05",
      existing: {
        leagueId: "123456789012345678",
        createdAt: new Date(),
      },
    });

    await expect(assertMonthlyReportGenerationAllowed({
      ctx: createContext(),
      leagueId: "123456789012345678",
      viewerUserId: "222222222222222222",
      ipAddress: "203.0.113.10",
    })).resolves.toBeUndefined();
  });

  it("applies the monthly blueprint quota to ADMIN_PERMISSIONS users too", async () => {
    process.env.ADMIN_PERMISSIONS = "mynameisbillex";
    reserveMonthlyReportGeneration.mockResolvedValueOnce({
      allowed: false,
      userKey: "auth:mynameisbillex",
      snapshotMonth: "2026-05",
      existing: {
        leagueId: "123456789012345678",
        createdAt: new Date(),
      },
    });

    await expect(assertMonthlyReportGenerationAllowed({
      ctx: createContext({
        openId: "mynameisbillex",
        name: "mynameisbillex",
      }),
      leagueId: "999999999999999999",
      viewerUserId: "222222222222222222",
      ipAddress: "203.0.113.10",
    })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    expect(reserveMonthlyReportGeneration).toHaveBeenCalledTimes(1);
  });
});
