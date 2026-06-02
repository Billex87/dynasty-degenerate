import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeStripeWebhookSignature,
  handleStripeWebhookPayload,
  verifyStripeWebhookSignature,
} from "./stripeWebhook";
import {
  upsertBillingCustomer,
  upsertBillingSubscription,
  upsertFeatureEntitlement,
  upsertLeaguePass,
} from "./db";
import {
  isTransactionalEmailConfigured,
  sendBillingNotificationEmail,
} from "./transactionalEmail";

vi.mock("./db", () => ({
  upsertBillingCustomer: vi.fn(),
  upsertBillingSubscription: vi.fn(),
  upsertFeatureEntitlement: vi.fn(),
  upsertLeaguePass: vi.fn(),
}));

vi.mock("./transactionalEmail", () => ({
  isTransactionalEmailConfigured: vi.fn(),
  sendBillingNotificationEmail: vi.fn(),
}));

const mockedUpsertBillingCustomer = vi.mocked(upsertBillingCustomer);
const mockedUpsertBillingSubscription = vi.mocked(upsertBillingSubscription);
const mockedUpsertFeatureEntitlement = vi.mocked(upsertFeatureEntitlement);
const mockedUpsertLeaguePass = vi.mocked(upsertLeaguePass);
const mockedIsTransactionalEmailConfigured = vi.mocked(isTransactionalEmailConfigured);
const mockedSendBillingNotificationEmail = vi.mocked(sendBillingNotificationEmail);

const secret = "whsec_test_secret";
const now = new Date("2026-06-02T12:00:00.000Z");
const timestamp = Math.floor(now.getTime() / 1000);
const originalAppBaseUrl = process.env.APP_BASE_URL;

function signedHeader(payload: string, overrideTimestamp = timestamp) {
  const signature = computeStripeWebhookSignature({
    payload,
    secret,
    timestamp: overrideTimestamp,
  });

  return `t=${overrideTimestamp},v1=${signature}`;
}

describe("Stripe webhook signature verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUpsertBillingCustomer.mockResolvedValue(true);
    mockedUpsertBillingSubscription.mockResolvedValue(true);
    mockedUpsertFeatureEntitlement.mockResolvedValue(true);
    mockedUpsertLeaguePass.mockResolvedValue(true);
    mockedIsTransactionalEmailConfigured.mockReturnValue(false);
    mockedSendBillingNotificationEmail.mockResolvedValue({ id: "email_test" });
    process.env.APP_BASE_URL = "https://dynastydegens.com";
  });

  afterEach(() => {
    if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalAppBaseUrl;
  });

  it("accepts a valid Stripe-style HMAC signature", () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "customer.subscription.updated",
    });

    const result = verifyStripeWebhookSignature({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toMatchObject({
      ok: true,
      timestamp,
    });
  });

  it("rejects mismatched signatures without parsing the event", async () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "customer.subscription.updated",
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: `t=${timestamp},v1=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb`,
      secret,
      now,
    });

    expect(result).toEqual({
      status: 400,
      body: {
        ok: false,
        error: "signature-mismatch",
      },
    });
  });

  it("rejects stale signatures outside the tolerance window", async () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "customer.subscription.updated",
    });

    const staleTimestamp = timestamp - 301;
    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload, staleTimestamp),
      secret,
      now,
    });

    expect(result.body.error).toBe("timestamp-outside-tolerance");
    expect(result.status).toBe(400);
  });

  it("fails closed when the webhook secret is missing", async () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "checkout.session.completed",
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret: "",
      now,
    });

    expect(result).toEqual({
      status: 500,
      body: {
        ok: false,
        error: "missing-secret",
      },
    });
  });

  it("rejects invalid JSON after signature verification", async () => {
    const payload = "{not-json";

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toEqual({
      status: 400,
      body: {
        ok: false,
        error: "invalid-json",
      },
    });
  });

  it("fails closed for supported events when app billing metadata is missing", async () => {
    const payload = JSON.stringify({
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          customer: "cus_test",
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toEqual({
      status: 422,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId: "evt_checkout",
        eventType: "checkout.session.completed",
        error: "missing-billing-metadata",
      },
    });
    expect(mockedUpsertBillingCustomer).not.toHaveBeenCalled();
  });

  it("persists subscription lifecycle events when app billing metadata is present", async () => {
    const payload = JSON.stringify({
      id: "evt_subscription",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test",
          customer: "cus_test",
          status: "active",
          current_period_start: 1_812_004_800,
          current_period_end: 1_814_597_600,
          cancel_at_period_end: false,
          metadata: {
            userOpenId: "email:user",
          },
          items: {
            data: [{
              price: {
                id: "price_pro",
                product: "prod_pro",
                lookup_key: "pro-monthly",
              },
            }],
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        received: true,
        persisted: true,
        eventId: "evt_subscription",
        eventType: "customer.subscription.updated",
      },
    });
    expect(mockedUpsertBillingCustomer).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      stripeCustomerId: "cus_test",
      status: "active",
    }));
    expect(mockedUpsertBillingSubscription).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      plan: "pro",
      status: "active",
      priceId: "price_pro",
      productId: "prod_pro",
      currentPeriodStart: new Date(1_812_004_800 * 1000),
      currentPeriodEnd: new Date(1_814_597_600 * 1000),
      cancelAtPeriodEnd: false,
    }));
  });

  it("marks deleted subscription events as canceled", async () => {
    mockedIsTransactionalEmailConfigured.mockReturnValue(true);
    const payload = JSON.stringify({
      id: "evt_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_test",
          customer: "cus_test",
          customer_email: "billing@example.com",
          metadata: {
            userOpenId: "email:user",
            plan: "elite",
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result.status).toBe(200);
    expect(mockedUpsertBillingSubscription).toHaveBeenCalledWith(expect.objectContaining({
      status: "canceled",
      plan: "elite",
    }));
    expect(mockedSendBillingNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      email: "billing@example.com",
      kind: "subscription-canceled",
      plan: "elite",
      appBaseUrl: "https://dynastydegens.com",
      eventId: "evt_deleted",
      eventType: "customer.subscription.deleted",
    }));
  });

  it("returns retryable 503 when billing persistence is unavailable", async () => {
    mockedUpsertBillingSubscription.mockResolvedValue(false);
    const payload = JSON.stringify({
      id: "evt_subscription",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_test",
          customer: "cus_test",
          status: "active",
          metadata: {
            userOpenId: "email:user",
            plan: "pro",
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toEqual({
      status: 503,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId: "evt_subscription",
        eventType: "customer.subscription.created",
        error: "billing-persistence-unavailable",
      },
    });
  });

  it("persists checkout session customers when app billing metadata is present", async () => {
    const payload = JSON.stringify({
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          customer: "cus_test",
          customer_email: "sample@example.com",
          mode: "subscription",
          metadata: {
            userOpenId: "email:user",
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result.status).toBe(200);
    expect(result.body.persisted).toBe(true);
    expect(mockedUpsertBillingCustomer).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      stripeCustomerId: "cus_test",
      email: "sample@example.com",
      metadata: expect.objectContaining({
        checkoutSessionId: "cs_test",
        mode: "subscription",
      }),
    }));
    expect(mockedUpsertFeatureEntitlement).not.toHaveBeenCalled();
    expect(mockedUpsertLeaguePass).not.toHaveBeenCalled();
  });

  it("persists league-pass checkout completions into league pass and league entitlements", async () => {
    const payload = JSON.stringify({
      id: "evt_checkout_league_pass",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_league_pass",
          customer: "cus_test",
          customer_email: "sample@example.com",
          mode: "payment",
          metadata: {
            userOpenId: "email:user",
            productKey: "league-pass-season",
            productType: "league-pass",
            plan: "league-pass",
            leagueId: "123456789012345678",
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        received: true,
        persisted: true,
        eventId: "evt_checkout_league_pass",
        eventType: "checkout.session.completed",
      },
    });
    expect(mockedUpsertLeaguePass).toHaveBeenCalledWith(expect.objectContaining({
      leagueId: "123456789012345678",
      purchaserOpenId: "email:user",
      stripeCustomerId: "cus_test",
      stripeCheckoutSessionId: "cs_league_pass",
      status: "active",
    }));
    expect(mockedUpsertFeatureEntitlement).toHaveBeenCalledTimes(3);
    expect(mockedUpsertFeatureEntitlement).toHaveBeenCalledWith(expect.objectContaining({
      subjectType: "league",
      leagueId: "123456789012345678",
      featureKey: "source-trace-details",
      plan: "league-pass",
      source: "stripe",
      sourceId: "cs_league_pass:source-trace-details",
      status: "active",
    }));
    expect(mockedUpsertFeatureEntitlement).toHaveBeenCalledWith(expect.objectContaining({
      featureKey: "ai-confidence-history",
      sourceId: "cs_league_pass:ai-confidence-history",
    }));
    expect(mockedUpsertFeatureEntitlement).toHaveBeenCalledWith(expect.objectContaining({
      featureKey: "exports",
      sourceId: "cs_league_pass:exports",
    }));
  });

  it("persists draft-kit checkout completions into user entitlements", async () => {
    const payload = JSON.stringify({
      id: "evt_checkout_draft_kit",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_rookie_kit",
          customer: "cus_test",
          mode: "payment",
          metadata: {
            userOpenId: "email:user",
            productKey: "rookie-draft-kit",
            productType: "draft-kit",
            plan: "one-time",
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result.status).toBe(200);
    expect(mockedUpsertFeatureEntitlement).toHaveBeenCalledWith(expect.objectContaining({
      subjectType: "user",
      userOpenId: "email:user",
      featureKey: "draft-kit-tools",
      plan: "one-time",
      source: "stripe",
      sourceId: "cs_rookie_kit:rookie-draft-kit",
      status: "active",
    }));
  });

  it("returns retryable 503 when checkout product entitlement persistence is unavailable", async () => {
    mockedUpsertFeatureEntitlement.mockResolvedValue(false);
    const payload = JSON.stringify({
      id: "evt_checkout_draft_kit",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_rookie_kit",
          customer: "cus_test",
          mode: "payment",
          metadata: {
            userOpenId: "email:user",
            productKey: "rookie-draft-kit",
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toEqual({
      status: 503,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId: "evt_checkout_draft_kit",
        eventType: "checkout.session.completed",
        error: "billing-persistence-unavailable",
      },
    });
  });

  it("marks subscriptions past due on failed invoice events with billing metadata", async () => {
    mockedIsTransactionalEmailConfigured.mockReturnValue(true);
    const payload = JSON.stringify({
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test",
          customer: "cus_test",
          customer_email: "billing@example.com",
          subscription: "sub_test",
          subscription_details: {
            metadata: {
              userOpenId: "email:user",
              plan: "pro",
            },
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        received: true,
        persisted: true,
        eventId: "evt_invoice_failed",
        eventType: "invoice.payment_failed",
      },
    });
    expect(mockedUpsertBillingSubscription).toHaveBeenCalledWith(expect.objectContaining({
      userOpenId: "email:user",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      plan: "pro",
      status: "past_due",
      metadata: expect.objectContaining({
        invoiceId: "in_test",
        stripeEventType: "invoice.payment_failed",
      }),
    }));
    expect(mockedSendBillingNotificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      email: "billing@example.com",
      kind: "payment-failed",
      plan: "pro",
      appBaseUrl: "https://dynastydegens.com",
      eventId: "evt_invoice_failed",
      eventType: "invoice.payment_failed",
    }));
  });

  it("does not fail Stripe webhook persistence when billing email delivery fails", async () => {
    mockedIsTransactionalEmailConfigured.mockReturnValue(true);
    mockedSendBillingNotificationEmail.mockRejectedValue(new Error("provider unavailable"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const payload = JSON.stringify({
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test",
          customer: "cus_test",
          customer_email: "billing@example.com",
          subscription: "sub_test",
          subscription_details: {
            metadata: {
              userOpenId: "email:user",
              plan: "pro",
            },
          },
        },
      },
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result.status).toBe(200);
    expect(result.body.persisted).toBe(true);
    expect(mockedSendBillingNotificationEmail).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "[Stripe Webhook] Billing notification email failed:",
      "provider unavailable"
    );
    warnSpy.mockRestore();
  });

  it("acknowledges and ignores unsupported Stripe events", async () => {
    const payload = JSON.stringify({
      id: "evt_balance",
      type: "balance.available",
    });

    const result = await handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result.body).toMatchObject({
      ok: true,
      received: true,
      persisted: false,
      ignored: true,
      eventId: "evt_balance",
      eventType: "balance.available",
    });
  });
});
