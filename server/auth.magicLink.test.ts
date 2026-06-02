import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
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
import {
  isTransactionalEmailConfigured,
  sendMagicLinkEmail,
} from "./transactionalEmail";

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

vi.mock("./transactionalEmail", async () => {
  const actual = await vi.importActual<typeof import("./transactionalEmail")>("./transactionalEmail");
  return {
    ...actual,
    isTransactionalEmailConfigured: vi.fn(),
    sendMagicLinkEmail: vi.fn(),
  };
});

const mockedInsertMagicLinkToken = vi.mocked(insertMagicLinkToken);
const mockedFindMagicLinkTokenByHash = vi.mocked(findMagicLinkTokenByHash);
const mockedMarkMagicLinkTokenConsumed = vi.mocked(markMagicLinkTokenConsumed);
const mockedUpsertUser = vi.mocked(upsertUser);
const mockedGetUserByOpenId = vi.mocked(getUserByOpenId);
const mockedIsTransactionalEmailConfigured = vi.mocked(isTransactionalEmailConfigured);
const mockedSendMagicLinkEmail = vi.mocked(sendMagicLinkEmail);
const routersSource = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf8");

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
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalTransactionalEmailFrom = process.env.TRANSACTIONAL_EMAIL_FROM;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test-secret";
    process.env.APP_BASE_URL = "https://dynastydegens.test";
    delete process.env.EXPOSE_MAGIC_LINK_DEV_TOKEN;
    delete process.env.RESEND_API_KEY;
    delete process.env.TRANSACTIONAL_EMAIL_FROM;
    vi.clearAllMocks();
    mockedIsTransactionalEmailConfigured.mockReturnValue(false);
    mockedSendMagicLinkEmail.mockResolvedValue({ id: "email_test" });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalAppBaseUrl;
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendApiKey;
    if (originalTransactionalEmailFrom === undefined) delete process.env.TRANSACTIONAL_EMAIL_FROM;
    else process.env.TRANSACTIONAL_EMAIL_FROM = originalTransactionalEmailFrom;
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
    expect(mockedSendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("sends configured magic-link email without exposing the raw token in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test";
    process.env.TRANSACTIONAL_EMAIL_FROM = "login@example.com";
    mockedIsTransactionalEmailConfigured.mockReturnValue(true);
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
      delivery: "sent",
    });
    expect("devToken" in result).toBe(false);
    expect(mockedSendMagicLinkEmail).toHaveBeenCalledWith({
      email: "sample@example.com",
      token: expect.any(String),
      tokenId: expect.any(String),
      redirectPath: "/",
      expiresAt: expect.any(Date),
      appBaseUrl: "https://dynastydegens.test",
    });
  });

  it("fails closed in production when magic-link email delivery is not configured", async () => {
    process.env.NODE_ENV = "production";
    mockedIsTransactionalEmailConfigured.mockReturnValue(false);
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.requestMagicLink({
      email: "sample@example.com",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Magic-link email delivery requires RESEND_API_KEY and TRANSACTIONAL_EMAIL_FROM in production.",
    });
    expect(mockedInsertMagicLinkToken).not.toHaveBeenCalled();
    expect(mockedSendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("marks delivery as sent when transactional email is configured in development", async () => {
    mockedIsTransactionalEmailConfigured.mockReturnValue(true);
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    mockedInsertMagicLinkToken.mockResolvedValue(true);

    const result = await caller.auth.requestMagicLink({
      email: "sample@example.com",
      redirectPath: "/report?leagueId=123",
    });

    expect(result.delivery).toBe("sent");
    expect(result.devToken).toEqual(expect.any(String));
    expect(mockedSendMagicLinkEmail).toHaveBeenCalledWith({
      email: "sample@example.com",
      token: result.devToken,
      tokenId: expect.any(String),
      redirectPath: "/report?leagueId=123",
      expiresAt: expect.any(Date),
      appBaseUrl: "https://dynastydegens.test",
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

  it("keeps magic-link request writes and email sends behind a route rate limit", () => {
    const start = routersSource.indexOf("requestMagicLink: publicProcedure");
    const end = routersSource.indexOf("consumeMagicLink: publicProcedure", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const routeSource = routersSource.slice(start, end);
    const rateLimitIndex = routeSource.indexOf("assertRateLimit(ctx.req as any");
    const emailRateLimitIndex = routeSource.indexOf('id: "auth.requestMagicLink.email"');
    const createTokenIndex = routeSource.indexOf("createMagicLinkToken({");
    const insertTokenIndex = routeSource.indexOf("insertMagicLinkToken(created.record)");
    const sendEmailIndex = routeSource.indexOf("sendMagicLinkEmail({");

    expect(rateLimitIndex).toBeGreaterThan(0);
    expect(emailRateLimitIndex).toBeGreaterThan(rateLimitIndex);
    expect(routeSource).toContain("scope: getMagicLinkUserOpenId(input.email)");
    expect(routeSource).toContain('clientKey: "recipient"');
    expect(createTokenIndex).toBeGreaterThan(rateLimitIndex);
    expect(createTokenIndex).toBeGreaterThan(emailRateLimitIndex);
    expect(insertTokenIndex).toBeGreaterThan(rateLimitIndex);
    expect(insertTokenIndex).toBeGreaterThan(emailRateLimitIndex);
    expect(sendEmailIndex).toBeGreaterThan(rateLimitIndex);
    expect(sendEmailIndex).toBeGreaterThan(emailRateLimitIndex);
    expect(routeSource).toContain('id: "auth.requestMagicLink"');
    expect(routeSource).toContain('max: 5');
  });

  it("consumes a valid token, creates a user session, and sets the session cookie", async () => {
    const now = new Date();
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

  it("keeps magic-link consume lookups and session writes behind a route rate limit", () => {
    const start = routersSource.indexOf("consumeMagicLink: publicProcedure");
    const end = routersSource.indexOf("adminLogin: publicProcedure", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const routeSource = routersSource.slice(start, end);
    const secretCheckIndex = routeSource.indexOf("assertSessionJwtSecretConfigured()");
    const rateLimitIndex = routeSource.indexOf("assertRateLimit(ctx.req as any");
    const emailRateLimitIndex = routeSource.indexOf('id: "auth.consumeMagicLink.email"');
    const tokenLookupIndex = routeSource.indexOf("findMagicLinkTokenByHash");
    const consumeTokenIndex = routeSource.indexOf("consumeMagicLinkToken({");
    const upsertUserIndex = routeSource.indexOf("upsertUser({");
    const cookieIndex = routeSource.indexOf("ctx.res.cookie(COOKIE_NAME");

    expect(secretCheckIndex).toBeGreaterThan(0);
    expect(rateLimitIndex).toBeGreaterThan(secretCheckIndex);
    expect(emailRateLimitIndex).toBeGreaterThan(rateLimitIndex);
    expect(routeSource).toContain("scope: getMagicLinkUserOpenId(input.email)");
    expect(routeSource).toContain('clientKey: "recipient"');
    expect(tokenLookupIndex).toBeGreaterThan(emailRateLimitIndex);
    expect(consumeTokenIndex).toBeGreaterThan(emailRateLimitIndex);
    expect(upsertUserIndex).toBeGreaterThan(emailRateLimitIndex);
    expect(cookieIndex).toBeGreaterThan(emailRateLimitIndex);
    expect(routeSource).toContain('id: "auth.consumeMagicLink"');
    expect(routeSource).toContain('max: 20');
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
