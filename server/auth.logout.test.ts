import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

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

describe("auth.adminLogin", () => {
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
        maxAge: 1000 * 60 * 60 * 24 * 365,
        secure: true,
        sameSite: "none",
        httpOnly: true,
        path: "/",
      });
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
