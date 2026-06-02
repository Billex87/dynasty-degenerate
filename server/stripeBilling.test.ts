import { describe, expect, it, vi } from "vitest";
import {
  createStripeCheckoutSession,
  createStripeCustomerPortalSession,
  resolveStripeBillingAppBaseUrl,
} from "./stripeBilling";

function createFetchMock(response: {
  ok?: boolean;
  status?: number;
  payload?: unknown;
}) {
  return vi.fn(async (_url: string, _init: RequestInit) => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.payload ?? {
      id: "cs_test_checkout",
      url: "https://checkout.stripe.com/c/test",
    },
  }));
}

function getPostedParams(fetchMock: ReturnType<typeof createFetchMock>) {
  const init = fetchMock.mock.calls[0]?.[1];
  return new URLSearchParams(String(init?.body ?? ""));
}

describe("Stripe billing helpers", () => {
  it("fails closed when the Stripe secret is missing", async () => {
    await expect(createStripeCheckoutSession({
      productKey: "pro-monthly",
      userOpenId: "email:user",
      userEmail: "sample@example.com",
      appBaseUrl: "https://dynasty.example",
      env: {
        STRIPE_PRICE_PRO_MONTHLY: "price_pro",
      },
      fetchImpl: createFetchMock({}),
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "STRIPE_SECRET_KEY is required for Stripe billing.",
    });
  });

  it("fails closed when a product price is missing", async () => {
    await expect(createStripeCheckoutSession({
      productKey: "elite-monthly",
      userOpenId: "email:user",
      appBaseUrl: "https://dynasty.example",
      env: {
        STRIPE_SECRET_KEY: "sk_test_secret",
      },
      fetchImpl: createFetchMock({}),
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "STRIPE_PRICE_ELITE_MONTHLY is required for Stripe billing.",
    });
  });

  it("requires a league ID for league-pass checkout", async () => {
    await expect(createStripeCheckoutSession({
      productKey: "league-pass-season",
      userOpenId: "email:user",
      appBaseUrl: "https://dynasty.example",
      env: {
        STRIPE_SECRET_KEY: "sk_test_secret",
        STRIPE_PRICE_LEAGUE_PASS_SEASON: "price_league",
      },
      fetchImpl: createFetchMock({}),
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "A league ID is required for league-pass checkout.",
    });
  });

  it("creates subscription checkout with user metadata copied onto the subscription", async () => {
    const fetchMock = createFetchMock({});

    const result = await createStripeCheckoutSession({
      productKey: "pro-monthly",
      userOpenId: "email:user",
      userEmail: "sample@example.com",
      appBaseUrl: "https://dynasty.example/ignored?x=1",
      returnPath: "/report?leagueId=123456789012345678",
      env: {
        STRIPE_SECRET_KEY: "sk_test_secret",
        STRIPE_PRICE_PRO_MONTHLY: "price_pro",
      },
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({
      id: "cs_test_checkout",
      url: "https://checkout.stripe.com/c/test",
      mode: "subscription",
      productKey: "pro-monthly",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/checkout/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk_test_secret",
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      })
    );
    const params = getPostedParams(fetchMock);
    expect(params.get("mode")).toBe("subscription");
    expect(params.get("line_items[0][price]")).toBe("price_pro");
    expect(params.get("line_items[0][quantity]")).toBe("1");
    expect(params.get("customer_email")).toBe("sample@example.com");
    expect(params.get("client_reference_id")).toBe("email:user");
    expect(params.get("metadata[userOpenId]")).toBe("email:user");
    expect(params.get("metadata[productKey]")).toBe("pro-monthly");
    expect(params.get("metadata[plan]")).toBe("pro");
    expect(params.get("subscription_data[metadata][userOpenId]")).toBe("email:user");
    expect(params.get("subscription_data[metadata][productKey]")).toBe("pro-monthly");
    expect(params.get("subscription_data[metadata][plan]")).toBe("pro");
    expect(params.get("payment_intent_data[metadata][userOpenId]")).toBeNull();
    expect(params.get("success_url")).toBe(
      "https://dynasty.example/report?leagueId=123456789012345678&billing=success&product=pro-monthly&session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.get("cancel_url")).toBe(
      "https://dynasty.example/report?leagueId=123456789012345678&billing=cancelled&product=pro-monthly"
    );
  });

  it("creates one-time checkout with payment metadata and a reusable Stripe customer", async () => {
    const fetchMock = createFetchMock({});

    await createStripeCheckoutSession({
      productKey: "league-pass-season",
      userOpenId: "email:user",
      userEmail: "sample@example.com",
      stripeCustomerId: "cus_existing",
      leagueId: "123456789012345678",
      appBaseUrl: "https://dynasty.example",
      returnPath: "/",
      env: {
        STRIPE_SECRET_KEY: "sk_test_secret",
        STRIPE_PRICE_LEAGUE_PASS_SEASON: "price_league",
      },
      fetchImpl: fetchMock,
    });

    const params = getPostedParams(fetchMock);
    expect(params.get("mode")).toBe("payment");
    expect(params.get("line_items[0][price]")).toBe("price_league");
    expect(params.get("customer")).toBe("cus_existing");
    expect(params.get("customer_email")).toBeNull();
    expect(params.get("customer_creation")).toBeNull();
    expect(params.get("metadata[productType]")).toBe("league-pass");
    expect(params.get("metadata[leagueId]")).toBe("123456789012345678");
    expect(params.get("payment_intent_data[metadata][userOpenId]")).toBe("email:user");
    expect(params.get("payment_intent_data[metadata][leagueId]")).toBe("123456789012345678");
  });

  it("does not leak secrets when Stripe rejects a checkout request", async () => {
    await expect(createStripeCheckoutSession({
      productKey: "pro-monthly",
      userOpenId: "email:user",
      appBaseUrl: "https://dynasty.example",
      env: {
        STRIPE_SECRET_KEY: "sk_test_secret",
        STRIPE_PRICE_PRO_MONTHLY: "price_pro",
      },
      fetchImpl: createFetchMock({
        ok: false,
        status: 402,
        payload: {
          error: {
            message: "card failed while using sk_test_secret",
          },
        },
      }),
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe billing request failed for /checkout/sessions with status 402.",
    });
  });

  it("creates customer portal sessions for a persisted Stripe customer", async () => {
    const fetchMock = createFetchMock({
      payload: {
        id: "bps_test_portal",
        url: "https://billing.stripe.com/p/session/test",
      },
    });

    const result = await createStripeCustomerPortalSession({
      stripeCustomerId: "cus_existing",
      appBaseUrl: "https://dynasty.example",
      returnPath: "/account",
      env: {
        STRIPE_SECRET_KEY: "sk_test_secret",
        STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID: "bpc_test",
      },
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({
      id: "bps_test_portal",
      url: "https://billing.stripe.com/p/session/test",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/billing_portal/sessions",
      expect.objectContaining({ method: "POST" })
    );
    const params = getPostedParams(fetchMock);
    expect(params.get("customer")).toBe("cus_existing");
    expect(params.get("configuration")).toBe("bpc_test");
    expect(params.get("return_url")).toBe("https://dynasty.example/account?billing=portal");
  });

  it("resolves app base URLs from explicit config and fails closed in production without it", () => {
    expect(resolveStripeBillingAppBaseUrl({
      env: {
        APP_BASE_URL: "https://dynasty.example/app?ignored=1",
      },
    })).toBe("https://dynasty.example");

    expect(resolveStripeBillingAppBaseUrl({
      env: {},
      nodeEnv: "test",
      requestProtocol: "http",
      requestHost: "localhost:5173",
    })).toBe("http://localhost:5173");

    expect(() => resolveStripeBillingAppBaseUrl({
      env: {},
      nodeEnv: "production",
      requestProtocol: "https",
      requestHost: "preview.example",
    })).toThrow("Stripe billing requires APP_BASE_URL in production.");
  });
});
