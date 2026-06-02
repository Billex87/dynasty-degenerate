import crypto from "node:crypto";

const MAGIC_LINK_TOKEN_BYTES = 32;
export const MAGIC_LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

export type MagicLinkTokenRecord = {
  tokenId: string;
  email: string;
  tokenHash: string;
  purpose: "login";
  redirectPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
  consumedAt?: Date | null;
  createdAt: Date;
};

export type CreateMagicLinkTokenInput = {
  email: string;
  redirectPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
  ttlMs?: number;
  token?: string;
  tokenId?: string;
};

export type CreatedMagicLinkToken = {
  token: string;
  record: MagicLinkTokenRecord;
};

export type ConsumeMagicLinkTokenResult =
  | {
      ok: true;
      record: MagicLinkTokenRecord;
    }
  | {
      ok: false;
      reason: "invalid-email" | "token-mismatch" | "expired" | "already-consumed";
    };

export function normalizeMagicLinkEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function hashMagicLinkToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

export function getMagicLinkUserOpenId(email: string): string {
  const normalized = normalizeMagicLinkEmail(email);
  if (!normalized) {
    throw new Error("A valid email address is required to derive a user identifier.");
  }

  return `email:${crypto.createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 58)}`;
}

export function normalizeMagicLinkRedirectPath(redirectPath?: string | null): string {
  const fallback = "/";
  const trimmed = String(redirectPath || "").trim();
  if (!trimmed) return fallback;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return fallback;

  try {
    const parsed = new URL(trimmed, "https://dynastydegens.local");
    if (parsed.origin !== "https://dynastydegens.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
  } catch {
    return fallback;
  }
}

function createOpaqueToken(): string {
  return crypto.randomBytes(MAGIC_LINK_TOKEN_BYTES).toString("base64url");
}

function createTokenId(): string {
  return crypto.randomUUID();
}

export function createMagicLinkToken(input: CreateMagicLinkTokenInput): CreatedMagicLinkToken {
  const email = normalizeMagicLinkEmail(input.email);
  if (!email) {
    throw new Error("A valid email address is required to create a magic link token.");
  }

  const now = input.now ?? new Date();
  const token = input.token ?? createOpaqueToken();
  const ttlMs = input.ttlMs ?? MAGIC_LINK_TOKEN_TTL_MS;

  return {
    token,
    record: {
      tokenId: input.tokenId ?? createTokenId(),
      email,
      tokenHash: hashMagicLinkToken(token),
      purpose: "login",
      redirectPath: normalizeMagicLinkRedirectPath(input.redirectPath),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt: new Date(now.getTime() + ttlMs),
      consumedAt: null,
      createdAt: now,
    },
  };
}

export function consumeMagicLinkToken(input: {
  record: MagicLinkTokenRecord;
  token: string;
  email: string;
  now?: Date;
}): ConsumeMagicLinkTokenResult {
  const email = normalizeMagicLinkEmail(input.email);
  if (!email || email !== input.record.email) {
    return { ok: false, reason: "invalid-email" };
  }

  if (input.record.consumedAt) {
    return { ok: false, reason: "already-consumed" };
  }

  const now = input.now ?? new Date();
  if (input.record.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  const expectedHash = input.record.tokenHash;
  const actualHash = hashMagicLinkToken(input.token);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(actualHash, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { ok: false, reason: "token-mismatch" };
  }

  return {
    ok: true,
    record: {
      ...input.record,
      consumedAt: now,
    },
  };
}
