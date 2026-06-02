import { describe, expect, it } from "vitest";
import {
  MAGIC_LINK_TOKEN_TTL_MS,
  consumeMagicLinkToken,
  createMagicLinkToken,
  getMagicLinkUserOpenId,
  hashMagicLinkToken,
  normalizeMagicLinkRedirectPath,
  normalizeMagicLinkEmail,
} from "./magicLinkTokens";

const now = new Date("2026-06-02T12:00:00.000Z");

describe("magic link tokens", () => {
  it("normalizes valid email addresses and rejects invalid addresses", () => {
    expect(normalizeMagicLinkEmail("  SAMPLE@Example.COM ")).toBe("sample@example.com");
    expect(normalizeMagicLinkEmail("not-an-email")).toBeNull();
  });

  it("creates an opaque token and stores only the hash in the record", () => {
    const result = createMagicLinkToken({
      email: "Sample@Example.com",
      token: "test-token",
      tokenId: "token-id",
      redirectPath: "/report?leagueId=123",
      ipAddress: "192.0.2.10",
      userAgent: "Vitest",
      now,
    });

    expect(result.token).toBe("test-token");
    expect(result.record).toMatchObject({
      tokenId: "token-id",
      email: "sample@example.com",
      tokenHash: hashMagicLinkToken("test-token"),
      purpose: "login",
      redirectPath: "/report?leagueId=123",
      ipAddress: "192.0.2.10",
      userAgent: "Vitest",
      consumedAt: null,
      createdAt: now,
    });
    expect(result.record.tokenHash).not.toBe(result.token);
    expect(result.record.expiresAt.getTime()).toBe(now.getTime() + MAGIC_LINK_TOKEN_TTL_MS);
  });

  it("consumes a matching token exactly once", () => {
    const created = createMagicLinkToken({
      email: "sample@example.com",
      token: "test-token",
      now,
    });
    const consumedAt = new Date(now.getTime() + 60_000);

    const first = consumeMagicLinkToken({
      record: created.record,
      token: created.token,
      email: "SAMPLE@example.com",
      now: consumedAt,
    });

    expect(first).toMatchObject({
      ok: true,
      record: {
        consumedAt,
      },
    });

    if (!first.ok) throw new Error("Expected first magic-link consumption to succeed.");
    expect(consumeMagicLinkToken({
      record: first.record,
      token: created.token,
      email: "sample@example.com",
      now: new Date(consumedAt.getTime() + 1_000),
    })).toEqual({
      ok: false,
      reason: "already-consumed",
    });
  });

  it("rejects expired tokens before comparing the token hash", () => {
    const created = createMagicLinkToken({
      email: "sample@example.com",
      token: "test-token",
      now,
      ttlMs: 60_000,
    });

    expect(consumeMagicLinkToken({
      record: created.record,
      token: "wrong-token",
      email: "sample@example.com",
      now: new Date(now.getTime() + 60_000),
    })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects mismatched token hashes and mismatched email addresses", () => {
    const created = createMagicLinkToken({
      email: "sample@example.com",
      token: "test-token",
      now,
    });

    expect(consumeMagicLinkToken({
      record: created.record,
      token: "wrong-token",
      email: "sample@example.com",
      now: new Date(now.getTime() + 60_000),
    })).toEqual({
      ok: false,
      reason: "token-mismatch",
    });

    expect(consumeMagicLinkToken({
      record: created.record,
      token: created.token,
      email: "other@example.com",
      now: new Date(now.getTime() + 60_000),
    })).toEqual({
      ok: false,
      reason: "invalid-email",
    });
  });

  it("throws before creating a token for invalid email input", () => {
    expect(() => createMagicLinkToken({
      email: "bad",
      now,
    })).toThrow(/valid email/i);
  });

  it("normalizes redirect paths to first-party relative paths only", () => {
    expect(normalizeMagicLinkRedirectPath("/report?leagueId=123#summary")).toBe("/report?leagueId=123#summary");
    expect(normalizeMagicLinkRedirectPath("https://evil.example/report")).toBe("/");
    expect(normalizeMagicLinkRedirectPath("//evil.example/report")).toBe("/");
    expect(normalizeMagicLinkRedirectPath("\\evil")).toBe("/");
    expect(createMagicLinkToken({
      email: "sample@example.com",
      token: "test-token",
      redirectPath: "https://evil.example/report",
      now,
    }).record.redirectPath).toBe("/");
  });

  it("derives stable bounded user identifiers from normalized email addresses", () => {
    const first = getMagicLinkUserOpenId("Sample@Example.com");
    const second = getMagicLinkUserOpenId(" sample@example.COM ");

    expect(first).toBe(second);
    expect(first).toMatch(/^email:[a-f0-9]{58}$/);
    expect(first.length).toBeLessThanOrEqual(64);
    expect(() => getMagicLinkUserOpenId("bad")).toThrow(/valid email/i);
  });
});
