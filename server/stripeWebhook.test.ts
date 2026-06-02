import { describe, expect, it } from "vitest";
import {
  computeStripeWebhookSignature,
  handleStripeWebhookPayload,
  verifyStripeWebhookSignature,
} from "./stripeWebhook";

const secret = "whsec_test_secret";
const now = new Date("2026-06-02T12:00:00.000Z");
const timestamp = Math.floor(now.getTime() / 1000);

function signedHeader(payload: string, overrideTimestamp = timestamp) {
  const signature = computeStripeWebhookSignature({
    payload,
    secret,
    timestamp: overrideTimestamp,
  });

  return `t=${overrideTimestamp},v1=${signature}`;
}

describe("Stripe webhook signature verification", () => {
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

  it("rejects mismatched signatures without parsing the event", () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "customer.subscription.updated",
    });

    const result = handleStripeWebhookPayload({
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

  it("rejects stale signatures outside the tolerance window", () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "customer.subscription.updated",
    });

    const staleTimestamp = timestamp - 301;
    const result = handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload, staleTimestamp),
      secret,
      now,
    });

    expect(result.body.error).toBe("timestamp-outside-tolerance");
    expect(result.status).toBe(400);
  });

  it("fails closed when the webhook secret is missing", () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "checkout.session.completed",
    });

    const result = handleStripeWebhookPayload({
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

  it("rejects invalid JSON after signature verification", () => {
    const payload = "{not-json";

    const result = handleStripeWebhookPayload({
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

  it("fails closed for supported billing events until webhook upserts are implemented", () => {
    const payload = JSON.stringify({
      id: "evt_checkout",
      type: "checkout.session.completed",
    });

    const result = handleStripeWebhookPayload({
      payload,
      signatureHeader: signedHeader(payload),
      secret,
      now,
    });

    expect(result).toEqual({
      status: 501,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId: "evt_checkout",
        eventType: "checkout.session.completed",
        error: "webhook-upsert-not-implemented",
      },
    });
  });

  it("acknowledges and ignores unsupported Stripe events", () => {
    const payload = JSON.stringify({
      id: "evt_balance",
      type: "balance.available",
    });

    const result = handleStripeWebhookPayload({
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
