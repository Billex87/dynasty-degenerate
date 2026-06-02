import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { createMagicLinkToken, hashMagicLinkToken } from "./magicLinkTokens";
import {
  findMagicLinkTokenByHash,
  getUserByOpenId,
  insertMagicLinkToken,
  markMagicLinkTokenConsumed,
  upsertUser,
} from "./db";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    findMagicLinkTokenByHash: vi.fn(),
    getUserByOpenId: vi.fn(),
    insertMagicLinkToken: vi.fn(),
    markMagicLinkTokenConsumed: vi.fn(),
    upsertUser: vi.fn(),
  };
});

const mockedInsertMagicLinkToken = vi.mocked(insertMagicLinkToken);
const mockedFindMagicLinkTokenByHash = vi.mocked(findMagicLinkTokenByHash);
const mockedMarkMagicLinkTokenConsumed = vi.mocked(markMagicLinkTokenConsumed);
const mockedUpsertUser = vi.mocked(upsertUser);
const mockedGetUserByOpenId = vi.mocked(getUserByOpenId);

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createTestContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      ip: "192.0.2.44",
      headers: {
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.8, 192.0.2.44",
      },
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, cookies };
}

const user: User = {
  id: 42,
  openId: "email:123",
  name: "sample@example.com",
  email: "sample@example.com",
  loginMethod: "magic-link",
  role: "user",
  createdAt: new Date("2026-06-02T12:00:00.000Z"),
  updatedAt: new Date("2026-06-02T12:00:00.000Z"),
  lastSignedIn: new Date("2026-06-02T12:00:00.000Z"),
};

describe("auth magic-link procedures", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalExposeToken = process.env.EXPOSE_MAGIC_LINK_DEV_TOKEN;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test-secret";
    delete process.env.EXPOSE_MAGIC_LINK_DEV_TOKEN;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalExposeToken === undefined) delete process.env.EXPOSE_MAGIC_LINK_DEV_TOKEN;
    else process.env.EXPOSE_MAGIC_LINK_DEV_TOKEN = originalExposeToken;
  });

  it("persists a hashed magic-link token and exposes the raw token only in non-production", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);
    let persistedTokenHash: string | null = null;

    mockedInsertMagicLinkToken.mockImplementation(async (record) => {
      persistedTokenHash = record.tokenHash;
      expect(record).toMatchObject({
        email: "sample@example.com",
        purpose: "login",
        redirectPath: "/report?leagueId=123",
        ipAddress: "203.0.113.8",
        userAgent: "Vitest",
        consumedAt: null,
      });
      return true;
    });

    const result = await caller.auth.requestMagicLink({
      email: " Sample@Example.com ",
      redirectPath: "/report?leagueId=123",
    });

    expect(result.success).toBe(true);
    expect(result.delivery).toBe("pending-email-provider");
    expect(result.redirectPath).toBe("/report?leagueId=123");
    expect(result.devToken).toEqual(expect.any(String));
    expect(persistedTokenHash).toBe(hashMagicLinkToken(result.devToken));
    expect(persistedTokenHash).not.toBe(result.devToken);
  });

  it("does not expose the raw magic-link token in production", async () => {
    process.env.NODE_ENV = "production";
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    mockedInsertMagicLinkToken.mockResolvedValue(true);

    const result = await caller.auth.requestMagicLink({
      email: "sample@example.com",
      redirectPath: "https://evil.example/report",
    });

    expect(result).toEqual({
      success: true,
      expiresAt: expect.any(Date),
      redirectPath: "/",
      delivery: "pending-email-provider",
    });
  });

  it("fails closed when token persistence is unavailable", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    mockedInsertMagicLinkToken.mockResolvedValue(false);

    await expect(caller.auth.requestMagicLink({
      email: "sample@example.com",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("consumes a valid token, creates a user session, and sets the session cookie", async () => {
    const now = new Date("2026-06-02T12:00:00.000Z");
    const created = createMagicLinkToken({
      email: "sample@example.com",
      token: "valid-test-token-for-route",
      redirectPath: "/report?leagueId=123",
      now,
    });
    const { ctx, cookies } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    mockedFindMagicLinkTokenByHash.mockResolvedValue(created.record);
    mockedMarkMagicLinkTokenConsumed.mockResolvedValue({
      ...created.record,
      consumedAt: new Date(now.getTime() + 60_000),
    });
    mockedUpsertUser.mockResolvedValue(undefined);
    mockedGetUserByOpenId.mockResolvedValue(user);

    const result = await caller.auth.consumeMagicLink({
      email: "Sample@Example.com",
      token: created.token,
    });

    expect(result).toEqual({
      success: true,
      redirectPath: "/report?leagueId=123",
    });
    expect(mockedFindMagicLinkTokenByHash).toHaveBeenCalledWith(hashMagicLinkToken(created.token));
    expect(mockedMarkMagicLinkTokenConsumed).toHaveBeenCalledWith({
      tokenId: created.record.tokenId,
      consumedAt: expect.any(Date),
    });
    expect(mockedUpsertUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "sample@example.com",
      loginMethod: "magic-link",
      role: "user",
    }));
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: COOKIE_NAME,
      value: expect.any(String),
      options: {
        secure: true,
        sameSite: "none",
        httpOnly: true,
        path: "/",
      },
    });
  });

  it("rejects replayed magic-link tokens when the consume update loses the race", async () => {
    const created = createMagicLinkToken({
      email: "sample@example.com",
      token: "valid-test-token-for-route",
      now: new Date("2026-06-02T12:00:00.000Z"),
    });
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    mockedFindMagicLinkTokenByHash.mockResolvedValue(created.record);
    mockedMarkMagicLinkTokenConsumed.mockResolvedValue(null);

    await expect(caller.auth.consumeMagicLink({
      email: "sample@example.com",
      token: created.token,
    })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid or expired magic link.",
    });
  });

  it("requires JWT_SECRET before issuing production magic-link sessions", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.consumeMagicLink({
      email: "sample@example.com",
      token: "valid-test-token-for-route",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Passwordless auth requires JWT_SECRET to be configured in production.",
    });
  });
});
