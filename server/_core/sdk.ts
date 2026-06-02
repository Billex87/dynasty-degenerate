import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export const LOCAL_AUTH_APP_ID = "dynasty-degenerates";
export const LOCAL_ADMIN_OPEN_ID = "local-admin";
const LOCAL_ADMIN_NAME = "Admin";
const LOCAL_SESSION_SECRET = "dynasty-degenerates-local-session-secret-v1";

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

function createFallbackAdminUser(signedInAt: Date): User {
  return {
    id: 0,
    openId: LOCAL_ADMIN_OPEN_ID,
    email: null,
    name: LOCAL_ADMIN_NAME,
    loginMethod: "admin-passphrase",
    role: "admin",
    createdAt: signedInAt,
    updatedAt: signedInAt,
    lastSignedIn: signedInAt,
  };
}

const shouldQuietDevLogs = () =>
  process.env.QUIET_DEV_LOGS === "true" ||
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true";

const devWarn = (...args: Parameters<typeof console.warn>) => {
  if (!shouldQuietDevLogs()) console.warn(...args);
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const configuredSecret = process.env.JWT_SECRET?.trim();
    const secret = configuredSecret || (process.env.NODE_ENV === "production" ? "" : LOCAL_SESSION_SECRET);
    return new TextEncoder().encode(secret);
  }

  async createAdminSessionToken(
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId: LOCAL_ADMIN_OPEN_ID,
        appId: LOCAL_AUTH_APP_ID,
        name: options.name || LOCAL_ADMIN_NAME,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session || session.appId !== LOCAL_AUTH_APP_ID) {
      throw ForbiddenError("Invalid session cookie");
    }

    const signedInAt = new Date();
    let user = await db.getUserByOpenId(session.openId);

    if (!user && session.openId === LOCAL_ADMIN_OPEN_ID) {
      await db.upsertUser({
        openId: LOCAL_ADMIN_OPEN_ID,
        name: session.name || LOCAL_ADMIN_NAME,
        email: null,
        loginMethod: "admin-passphrase",
        role: "admin",
        lastSignedIn: signedInAt,
      });
      user = await db.getUserByOpenId(LOCAL_ADMIN_OPEN_ID);
    }

    if (!user && session.openId === LOCAL_ADMIN_OPEN_ID) {
      return createFallbackAdminUser(signedInAt);
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      name: user.name,
      email: user.email,
      loginMethod: user.loginMethod,
      role: user.role,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
