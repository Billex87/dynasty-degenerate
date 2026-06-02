import { describe, expect, it, vi } from "vitest";
import {
  assertTransactionalEmailConfiguredForProduction,
  buildMagicLinkUrl,
  isTransactionalEmailConfigured,
  resolveTransactionalEmailAppBaseUrl,
  sendMagicLinkEmail,
  sendTransactionalEmail,
} from "./transactionalEmail";

function createFetchMock(response: {
  ok?: boolean;
  status?: number;
  payload?: unknown;
}) {
  return vi.fn(async (_url: string, _init: RequestInit) => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.payload ?? { id: "email_test" },
  }));
}

function getRequest(fetchMock: ReturnType<typeof createFetchMock>) {
  const [url, init] = fetchMock.mock.calls[0];
  return {
    url,
    init,
    body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>,
    headers: init.headers as Record<string, string>,
  };
}

describe("transactional email", () => {
  it("detects configured Resend email delivery", () => {
    expect(isTransactionalEmailConfigured({
      RESEND_API_KEY: "re_test",
      TRANSACTIONAL_EMAIL_FROM: "Dynasty Degens <login@example.com>",
    })).toBe(true);
    expect(isTransactionalEmailConfigured({
      RESEND_API_KEY: "re_test",
    })).toBe(false);
  });

  it("requires provider config in production", () => {
    expect(() => assertTransactionalEmailConfiguredForProduction({
      env: { NODE_ENV: "production" },
    })).toThrow("Magic-link email delivery requires RESEND_API_KEY and TRANSACTIONAL_EMAIL_FROM in production.");

    expect(() => assertTransactionalEmailConfiguredForProduction({
      env: {
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
        TRANSACTIONAL_EMAIL_FROM: "login@example.com",
      },
    })).not.toThrow();
  });

  it("resolves app base URLs from config or request headers", () => {
    expect(resolveTransactionalEmailAppBaseUrl({
      env: {
        APP_BASE_URL: "https://dynastydegens.com/path?ignored=1",
      },
    })).toBe("https://dynastydegens.com");

    expect(resolveTransactionalEmailAppBaseUrl({
      env: {},
      nodeEnv: "development",
      requestProtocol: "http",
      requestHost: "localhost:3000",
    })).toBe("http://localhost:3000");

    expect(() => resolveTransactionalEmailAppBaseUrl({
      env: {},
      nodeEnv: "production",
    })).toThrow("Magic-link email delivery requires APP_BASE_URL in production.");
  });

  it("builds first-party magic-link URLs with encoded token and redirect state", () => {
    const url = buildMagicLinkUrl({
      appBaseUrl: "https://dynastydegens.com",
      email: "sample@example.com",
      token: "raw token with spaces",
      redirectPath: "/report?leagueId=123",
    });

    expect(url).toBe("https://dynastydegens.com/auth/magic-link?email=sample%40example.com&token=raw+token+with+spaces&redirectPath=%2Freport%3FleagueId%3D123");
  });

  it("sends Resend email requests with server-only auth and idempotency headers", async () => {
    const fetchMock = createFetchMock({});

    const result = await sendTransactionalEmail({
      to: "sample@example.com",
      subject: "Test subject",
      text: "Text body",
      html: "<p>HTML body</p>",
      idempotencyKey: "magic-link/token-id",
      env: {
        RESEND_API_KEY: "re_test_secret",
        TRANSACTIONAL_EMAIL_FROM: "Dynasty Degens <login@example.com>",
        TRANSACTIONAL_EMAIL_REPLY_TO: "support@example.com",
      },
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({ id: "email_test" });
    const request = getRequest(fetchMock);
    expect(request.url).toBe("https://api.resend.com/emails");
    expect(request.init.method).toBe("POST");
    expect(request.headers).toMatchObject({
      Authorization: "Bearer re_test_secret",
      "Content-Type": "application/json",
      "Idempotency-Key": "magic-link/token-id",
    });
    expect(request.body).toEqual({
      from: "Dynasty Degens <login@example.com>",
      to: ["sample@example.com"],
      subject: "Test subject",
      text: "Text body",
      html: "<p>HTML body</p>",
      reply_to: "support@example.com",
    });
  });

  it("sends magic-link email content without exposing provider errors", async () => {
    const fetchMock = createFetchMock({
      ok: false,
      status: 403,
      payload: {
        message: "provider detail with re_test_secret",
      },
    });

    await expect(sendMagicLinkEmail({
      email: "sample@example.com",
      token: "secret-token",
      tokenId: "token-id",
      redirectPath: "/report?leagueId=123",
      expiresAt: new Date("2026-06-02T12:15:00.000Z"),
      appBaseUrl: "https://dynastydegens.com",
      env: {
        RESEND_API_KEY: "re_test_secret",
        TRANSACTIONAL_EMAIL_FROM: "login@example.com",
      },
      fetchImpl: fetchMock,
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Transactional email request failed with status 403.",
    });
  });
});
