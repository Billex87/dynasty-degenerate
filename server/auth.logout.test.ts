import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { sdk } from "./_core/sdk";

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
});
