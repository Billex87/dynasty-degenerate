import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { sdk } from "./_core/sdk";

const routersSource = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf8");

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
  value?: string;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "admin-passphrase",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth context", () => {
  it("treats missing public-request cookies as anonymous without warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const ctx = await createContext({
        req: {
          headers: {},
          protocol: "https",
        },
        res: {},
      } as Parameters<typeof createContext>[0]);

      expect(ctx.user).toBeNull();
      expect(warnSpy).not.toHaveBeenCalledWith("[Auth] Missing session cookie");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("treats expired session cookies as anonymous", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const expiredToken = await sdk.createAdminSessionToken({
      expiresInMs: -60_000,
    });

    try {
      const ctx = await createContext({
        req: {
          headers: {
            cookie: `${COOKIE_NAME}=${expiredToken}`,
          },
          protocol: "https",
        },
        res: {},
      } as Parameters<typeof createContext>[0]);

      expect(ctx.user).toBeNull();
      expect(warnSpy.mock.calls.some(([message]) => message === "[Auth] Session verification failed")).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("auth.adminLogin", () => {
  it("requires JWT_SECRET in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAdminPassword = process.env.ADMIN_LOGIN_PASSWORD;
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    process.env.ADMIN_LOGIN_PASSWORD = "correct horse battery staple";

    try {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.adminLogin({ passphrase: "correct horse battery staple" })
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Admin login requires JWT_SECRET to be configured in production.",
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalJwtSecret;
      if (originalAdminPassword === undefined) delete process.env.ADMIN_LOGIN_PASSWORD;
      else process.env.ADMIN_LOGIN_PASSWORD = originalAdminPassword;
    }
  });

  it("requires ADMIN_LOGIN_PASSWORD before accepting admin login", async () => {
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAdminPassword = process.env.ADMIN_LOGIN_PASSWORD;
    process.env.JWT_SECRET = "test-secret";
    delete process.env.ADMIN_LOGIN_PASSWORD;

    try {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.adminLogin({ passphrase: "correct horse battery staple" })
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Admin login requires ADMIN_LOGIN_PASSWORD to be configured.",
      });
    } finally {
      if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalJwtSecret;
      if (originalAdminPassword === undefined) delete process.env.ADMIN_LOGIN_PASSWORD;
      else process.env.ADMIN_LOGIN_PASSWORD = originalAdminPassword;
    }
  });

  it("accepts the local Alstott40! password without JWT_SECRET", async () => {
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAdminPassword = process.env.ADMIN_LOGIN_PASSWORD;
    delete process.env.JWT_SECRET;
    process.env.ADMIN_LOGIN_PASSWORD = "Alstott40!";

    try {
      const { ctx, clearedCookies } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.adminLogin({
        passphrase: "Alstott40!",
      });

      expect(result).toEqual({ success: true });
      expect(clearedCookies).toHaveLength(1);
      expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
      expect(clearedCookies[0]?.value).toEqual(expect.any(String));
    } finally {
      if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalJwtSecret;
      if (originalAdminPassword === undefined) delete process.env.ADMIN_LOGIN_PASSWORD;
      else process.env.ADMIN_LOGIN_PASSWORD = originalAdminPassword;
    }
  });

  it("sets the session cookie for a valid admin passphrase", async () => {
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAdminPassword = process.env.ADMIN_LOGIN_PASSWORD;
    process.env.JWT_SECRET = "test-secret";
    process.env.ADMIN_LOGIN_PASSWORD = "correct horse battery staple";

    try {
      const { ctx, clearedCookies } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.adminLogin({
        passphrase: "correct horse battery staple",
      });

      expect(result).toEqual({ success: true });
      expect(clearedCookies).toHaveLength(1);
      expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
      expect(clearedCookies[0]?.value).toEqual(expect.any(String));
      expect(clearedCookies[0]?.options).toMatchObject({
        secure: true,
        sameSite: "none",
        httpOnly: true,
        path: "/",
      });
      expect(clearedCookies[0]?.options).not.toHaveProperty("maxAge");
    } finally {
      if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalJwtSecret;
      if (originalAdminPassword === undefined) delete process.env.ADMIN_LOGIN_PASSWORD;
      else process.env.ADMIN_LOGIN_PASSWORD = originalAdminPassword;
    }
  });

  it("rejects an invalid admin passphrase", async () => {
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAdminPassword = process.env.ADMIN_LOGIN_PASSWORD;
    process.env.JWT_SECRET = "test-secret";
    process.env.ADMIN_LOGIN_PASSWORD = "correct horse battery staple";

    try {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.auth.adminLogin({ passphrase: "wrong" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    } finally {
      if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalJwtSecret;
      if (originalAdminPassword === undefined) delete process.env.ADMIN_LOGIN_PASSWORD;
      else process.env.ADMIN_LOGIN_PASSWORD = originalAdminPassword;
    }
  });

  it("keeps passphrase checks and session writes behind an admin login rate limit", () => {
    const start = routersSource.indexOf("adminLogin: publicProcedure");
    const end = routersSource.indexOf("logout: publicProcedure", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const routeSource = routersSource.slice(start, end);
    const jwtPreconditionIndex = routeSource.indexOf('process.env.NODE_ENV === "production" && !process.env.JWT_SECRET');
    const passwordPreconditionIndex = routeSource.indexOf("if (!getAdminLoginPassword())");
    const rateLimitIndex = routeSource.indexOf("assertRateLimit(ctx.req as any");
    const passphraseCheckIndex = routeSource.indexOf("isValidAdminLoginPassword(input.passphrase)");
    const upsertUserIndex = routeSource.indexOf("upsertUser({");
    const cookieIndex = routeSource.indexOf("ctx.res.cookie(COOKIE_NAME");

    expect(jwtPreconditionIndex).toBeGreaterThan(0);
    expect(passwordPreconditionIndex).toBeGreaterThan(jwtPreconditionIndex);
    expect(rateLimitIndex).toBeGreaterThan(passwordPreconditionIndex);
    expect(passphraseCheckIndex).toBeGreaterThan(rateLimitIndex);
    expect(upsertUserIndex).toBeGreaterThan(rateLimitIndex);
    expect(cookieIndex).toBeGreaterThan(rateLimitIndex);
    expect(routeSource).toContain('id: "auth.adminLogin"');
    expect(routeSource).toContain('max: 8');
  });
});
