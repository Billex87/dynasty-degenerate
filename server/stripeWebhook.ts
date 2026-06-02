import crypto from "node:crypto";
import { upsertBillingCustomer, upsertBillingSubscription, upsertFeatureEntitlement, upsertLeaguePass } from "./db";

const DEFAULT_TOLERANCE_SECONDS = 300;
const SUPPORTED_STRIPE_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

type StripeWebhookVerificationFailureReason =
  | "missing-secret"
  | "missing-signature"
  | "invalid-timestamp"
  | "timestamp-outside-tolerance"
  | "signature-mismatch";

export type StripeWebhookVerificationInput = {
  payload: Buffer | string;
  signatureHeader: string | null | undefined;
  secret: string | null | undefined;
  toleranceSeconds?: number;
  now?: Date;
};

export type StripeWebhookVerificationResult =
  | {
      ok: true;
      timestamp: number;
      matchedSignature: string;
    }
  | {
      ok: false;
      reason: StripeWebhookVerificationFailureReason;
    };

export type StripeWebhookRouteResult = {
  status: number;
  body: {
    ok: boolean;
    received?: boolean;
    persisted?: boolean;
    eventId?: string | null;
    eventType?: string | null;
    ignored?: boolean;
    error?: string;
  };
};

type StripeWebhookEvent = {
  id?: unknown;
  type?: unknown;
  data?: {
    object?: Record<string, unknown>;
  };
};

const LEAGUE_PASS_FEATURE_ENTITLEMENTS = [
  "source-trace-details",
  "ai-confidence-history",
  "exports",
] as const;

const DRAFT_KIT_PRODUCT_KEYS = new Set(["rookie-draft-kit", "redraft-draft-kit"]);

type ParsedStripeSignature = {
  timestamp: number | null;
  signatures: string[];
};

function parseStripeSignatureHeader(signatureHeader: string): ParsedStripeSignature {
  return signatureHeader.split(",").reduce<ParsedStripeSignature>(
    (parsed, part) => {
      const [rawKey, ...rawValueParts] = part.split("=");
      const key = rawKey?.trim();
      const value = rawValueParts.join("=").trim();
      if (!key || !value) return parsed;

      if (key === "t") {
        const timestamp = Number(value);
        return {
          ...parsed,
          timestamp: Number.isSafeInteger(timestamp) ? timestamp : null,
        };
      }

      if (key === "v1") {
        return {
          ...parsed,
          signatures: [...parsed.signatures, value],
        };
      }

      return parsed;
    },
    { timestamp: null, signatures: [] }
  );
}

function toPayloadBuffer(payload: Buffer | string): Buffer {
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function computeStripeWebhookSignature(input: {
  payload: Buffer | string;
  secret: string;
  timestamp: number;
}): string {
  const signedPayload = Buffer.concat([
    Buffer.from(`${input.timestamp}.`, "utf8"),
    toPayloadBuffer(input.payload),
  ]);

  return crypto
    .createHmac("sha256", input.secret)
    .update(signedPayload)
    .digest("hex");
}

export function verifyStripeWebhookSignature(input: StripeWebhookVerificationInput): StripeWebhookVerificationResult {
  const secret = input.secret?.trim();
  if (!secret) return { ok: false, reason: "missing-secret" };
  if (!input.signatureHeader) return { ok: false, reason: "missing-signature" };

  const parsed = parseStripeSignatureHeader(input.signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    return { ok: false, reason: "invalid-timestamp" };
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) {
    return { ok: false, reason: "timestamp-outside-tolerance" };
  }

  const expectedSignature = computeStripeWebhookSignature({
    payload: input.payload,
    secret,
    timestamp: parsed.timestamp,
  });
  const matchedSignature = parsed.signatures.find((signature) => timingSafeEqualHex(signature, expectedSignature));

  if (!matchedSignature) return { ok: false, reason: "signature-mismatch" };
  return {
    ok: true,
    timestamp: parsed.timestamp,
    matchedSignature,
  };
}

function getJsonPayload(payload: Buffer | string): unknown {
  const text = toPayloadBuffer(payload).toString("utf8");
  return JSON.parse(text);
}

function getObjectStringValue(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNestedObject(input: unknown, key: string): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getStripeId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") return getObjectStringValue(value, "id");
  return null;
}

function getStripeUnixDate(value: unknown): Date | null {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

function getStripeMetadataValue(object: Record<string, unknown>, ...keys: string[]): string | null {
  const metadata = getNestedObject(object, "metadata");
  if (!metadata) return null;
  for (const key of keys) {
    const value = getObjectStringValue(metadata, key);
    if (value) return value;
  }
  return null;
}

function getCheckoutProductKey(checkoutSession: Record<string, unknown>): string | null {
  return getStripeMetadataValue(checkoutSession, "productKey", "product_key");
}

function normalizeBillingPlan(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("elite")) return "elite";
  if (normalized.includes("pro")) return "pro";
  if (normalized === "free") return "free";
  return null;
}

async function persistLeaguePassCheckout(input: {
  checkoutSession: Record<string, unknown>;
  eventId: string | null;
  eventType: string;
  userOpenId: string;
  stripeCustomerId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const checkoutSessionId = getObjectStringValue(input.checkoutSession, "id");
  const leagueId = getStripeMetadataValue(input.checkoutSession, "leagueId", "league_id");
  if (!checkoutSessionId || !leagueId) {
    return { ok: false, status: 422, error: "missing-billing-metadata" };
  }

  const metadata = {
    stripeEventId: input.eventId,
    stripeEventType: input.eventType,
    checkoutSessionId,
    productKey: "league-pass-season",
    audience: "all-managers",
  };

  const leaguePassPersisted = await upsertLeaguePass({
    leagueId,
    purchaserOpenId: input.userOpenId,
    stripeCustomerId: input.stripeCustomerId,
    stripeCheckoutSessionId: checkoutSessionId,
    status: "active",
    metadata,
  });
  if (!leaguePassPersisted) {
    return { ok: false, status: 503, error: "billing-persistence-unavailable" };
  }

  for (const featureKey of LEAGUE_PASS_FEATURE_ENTITLEMENTS) {
    const entitlementPersisted = await upsertFeatureEntitlement({
      subjectType: "league",
      leagueId,
      featureKey,
      plan: "league-pass",
      source: "stripe",
      sourceId: `${checkoutSessionId}:${featureKey}`,
      status: "active",
      metadata,
    });
    if (!entitlementPersisted) {
      return { ok: false, status: 503, error: "billing-persistence-unavailable" };
    }
  }

  return { ok: true };
}

async function persistDraftKitCheckout(input: {
  checkoutSession: Record<string, unknown>;
  eventId: string | null;
  eventType: string;
  productKey: string;
  userOpenId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const checkoutSessionId = getObjectStringValue(input.checkoutSession, "id");
  if (!checkoutSessionId) {
    return { ok: false, status: 422, error: "missing-billing-metadata" };
  }

  const entitlementPersisted = await upsertFeatureEntitlement({
    subjectType: "user",
    userOpenId: input.userOpenId,
    featureKey: "draft-kit-tools",
    plan: "one-time",
    source: "stripe",
    sourceId: `${checkoutSessionId}:${input.productKey}`,
    status: "active",
    metadata: {
      stripeEventId: input.eventId,
      stripeEventType: input.eventType,
      checkoutSessionId,
      productKey: input.productKey,
    },
  });

  return entitlementPersisted
    ? { ok: true }
    : { ok: false, status: 503, error: "billing-persistence-unavailable" };
}

async function persistCheckoutProductEntitlements(input: {
  checkoutSession: Record<string, unknown>;
  eventId: string | null;
  eventType: string;
  userOpenId: string;
  stripeCustomerId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const productKey = getCheckoutProductKey(input.checkoutSession);
  if (!productKey || productKey === "pro-monthly" || productKey === "elite-monthly") {
    return { ok: true };
  }

  if (productKey === "league-pass-season") {
    return persistLeaguePassCheckout(input);
  }

  if (DRAFT_KIT_PRODUCT_KEYS.has(productKey)) {
    return persistDraftKitCheckout({
      checkoutSession: input.checkoutSession,
      eventId: input.eventId,
      eventType: input.eventType,
      productKey,
      userOpenId: input.userOpenId,
    });
  }

  return { ok: false, status: 422, error: "unsupported-checkout-product" };
}

function getSubscriptionPrice(subscription: Record<string, unknown>): Record<string, unknown> | null {
  const items = getNestedObject(subscription, "items");
  const data = Array.isArray(items?.data) ? items.data : [];
  const firstItem = data.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  return firstItem ? getNestedObject(firstItem, "price") : null;
}

function getSubscriptionPlan(subscription: Record<string, unknown>): string | null {
  const price = getSubscriptionPrice(subscription);
  const priceMetadata = price ? getNestedObject(price, "metadata") : null;
  return normalizeBillingPlan(
    getStripeMetadataValue(subscription, "plan", "billingPlan", "tier") ||
    getObjectStringValue(priceMetadata, "plan") ||
    getObjectStringValue(price, "lookup_key")
  );
}

function getSubscriptionUserOpenId(subscription: Record<string, unknown>): string | null {
  return getStripeMetadataValue(subscription, "userOpenId", "user_open_id", "openId");
}

function getSubscriptionPriceId(subscription: Record<string, unknown>): string | null {
  const price = getSubscriptionPrice(subscription);
  return price ? getObjectStringValue(price, "id") : null;
}

function getSubscriptionProductId(subscription: Record<string, unknown>): string | null {
  const price = getSubscriptionPrice(subscription);
  return price ? getStripeId(price.product) : null;
}

async function persistSubscriptionEvent(event: StripeWebhookEvent, eventType: string): Promise<StripeWebhookRouteResult> {
  const object = event.data?.object;
  const eventId = typeof event.id === "string" ? event.id : null;
  if (!object) {
    return {
      status: 400,
      body: { ok: false, received: true, persisted: false, eventId, eventType, error: "missing-event-object" },
    };
  }

  const userOpenId = getSubscriptionUserOpenId(object);
  const stripeCustomerId = getStripeId(object.customer);
  const stripeSubscriptionId = getObjectStringValue(object, "id");
  const plan = getSubscriptionPlan(object);
  const status = eventType === "customer.subscription.deleted"
    ? "canceled"
    : getObjectStringValue(object, "status");

  if (!userOpenId || !stripeCustomerId || !stripeSubscriptionId || !plan || !status) {
    return {
      status: 422,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId,
        eventType,
        error: "missing-billing-metadata",
      },
    };
  }

  const customerPersisted = await upsertBillingCustomer({
    userOpenId,
    stripeCustomerId,
    status: "active",
    metadata: {
      stripeEventId: eventId,
      stripeEventType: eventType,
    },
  });
  const subscriptionPersisted = await upsertBillingSubscription({
    userOpenId,
    stripeCustomerId,
    stripeSubscriptionId,
    plan,
    status,
    priceId: getSubscriptionPriceId(object),
    productId: getSubscriptionProductId(object),
    currentPeriodStart: getStripeUnixDate(object.current_period_start),
    currentPeriodEnd: getStripeUnixDate(object.current_period_end),
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
    metadata: {
      stripeEventId: eventId,
      stripeEventType: eventType,
    },
  });

  if (!customerPersisted || !subscriptionPersisted) {
    return {
      status: 503,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId,
        eventType,
        error: "billing-persistence-unavailable",
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      received: true,
      persisted: true,
      eventId,
      eventType,
    },
  };
}

async function persistCheckoutCompletedEvent(event: StripeWebhookEvent, eventType: string): Promise<StripeWebhookRouteResult> {
  const object = event.data?.object;
  const eventId = typeof event.id === "string" ? event.id : null;
  if (!object) {
    return {
      status: 400,
      body: { ok: false, received: true, persisted: false, eventId, eventType, error: "missing-event-object" },
    };
  }

  const userOpenId = getStripeMetadataValue(object, "userOpenId", "user_open_id", "openId");
  const stripeCustomerId = getStripeId(object.customer);
  if (!userOpenId || !stripeCustomerId) {
    return {
      status: 422,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId,
        eventType,
        error: "missing-billing-metadata",
      },
    };
  }

  const customerPersisted = await upsertBillingCustomer({
    userOpenId,
    stripeCustomerId,
    email: getObjectStringValue(object, "customer_email"),
    status: "active",
    metadata: {
      stripeEventId: eventId,
      stripeEventType: eventType,
      checkoutSessionId: getObjectStringValue(object, "id"),
      mode: getObjectStringValue(object, "mode"),
    },
  });
  const productEntitlementsPersisted = customerPersisted
    ? await persistCheckoutProductEntitlements({
      checkoutSession: object,
      eventId,
      eventType,
      userOpenId,
      stripeCustomerId,
    })
    : { ok: false as const, status: 503, error: "billing-persistence-unavailable" };

  return {
    status: productEntitlementsPersisted.ok ? 200 : productEntitlementsPersisted.status,
    body: {
      ok: productEntitlementsPersisted.ok,
      received: true,
      persisted: productEntitlementsPersisted.ok,
      eventId,
      eventType,
      error: productEntitlementsPersisted.ok ? undefined : productEntitlementsPersisted.error,
    },
  };
}

async function persistInvoicePaymentFailedEvent(event: StripeWebhookEvent, eventType: string): Promise<StripeWebhookRouteResult> {
  const object = event.data?.object;
  const eventId = typeof event.id === "string" ? event.id : null;
  if (!object) {
    return {
      status: 400,
      body: { ok: false, received: true, persisted: false, eventId, eventType, error: "missing-event-object" },
    };
  }

  const subscriptionDetails = getNestedObject(object, "subscription_details");
  const userOpenId = getStripeMetadataValue(object, "userOpenId", "user_open_id", "openId")
    ?? (subscriptionDetails ? getStripeMetadataValue(subscriptionDetails, "userOpenId", "user_open_id", "openId") : null);
  const plan = normalizeBillingPlan(
    getStripeMetadataValue(object, "plan", "billingPlan", "tier")
    ?? (subscriptionDetails ? getStripeMetadataValue(subscriptionDetails, "plan", "billingPlan", "tier") : null)
  );
  const stripeCustomerId = getStripeId(object.customer);
  const stripeSubscriptionId = getStripeId(object.subscription);

  if (!userOpenId || !stripeCustomerId || !stripeSubscriptionId || !plan) {
    return {
      status: 422,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId,
        eventType,
        error: "missing-billing-metadata",
      },
    };
  }

  const subscriptionPersisted = await upsertBillingSubscription({
    userOpenId,
    stripeCustomerId,
    stripeSubscriptionId,
    plan,
    status: "past_due",
    metadata: {
      stripeEventId: eventId,
      stripeEventType: eventType,
      invoiceId: getObjectStringValue(object, "id"),
    },
  });

  if (!subscriptionPersisted) {
    return {
      status: 503,
      body: {
        ok: false,
        received: true,
        persisted: false,
        eventId,
        eventType,
        error: "billing-persistence-unavailable",
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      received: true,
      persisted: true,
      eventId,
      eventType,
    },
  };
}

async function persistStripeWebhookEvent(event: StripeWebhookEvent, eventType: string): Promise<StripeWebhookRouteResult> {
  if (eventType === "checkout.session.completed") {
    return persistCheckoutCompletedEvent(event, eventType);
  }

  if (eventType.startsWith("customer.subscription.")) {
    return persistSubscriptionEvent(event, eventType);
  }

  if (eventType === "invoice.payment_failed") {
    return persistInvoicePaymentFailedEvent(event, eventType);
  }

  return {
    status: 200,
    body: {
      ok: true,
      received: true,
      persisted: false,
      eventId: typeof event.id === "string" ? event.id : null,
      eventType,
      ignored: true,
    },
  };
}

function verificationReasonToStatus(reason: StripeWebhookVerificationFailureReason): number {
  return reason === "missing-secret" ? 500 : 400;
}

export async function handleStripeWebhookPayload(input: StripeWebhookVerificationInput): Promise<StripeWebhookRouteResult> {
  const verification = verifyStripeWebhookSignature(input);
  if (!verification.ok) {
    return {
      status: verificationReasonToStatus(verification.reason),
      body: {
        ok: false,
        error: verification.reason,
      },
    };
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = getJsonPayload(input.payload);
  } catch {
    return {
      status: 400,
      body: {
        ok: false,
        error: "invalid-json",
      },
    };
  }

  const event = parsedPayload as StripeWebhookEvent;
  const eventId = getObjectStringValue(event, "id");
  const eventType = getObjectStringValue(event, "type");
  if (!eventType) {
    return {
      status: 400,
      body: {
        ok: false,
        eventId,
        eventType,
        error: "missing-event-type",
      },
    };
  }

  if (!SUPPORTED_STRIPE_WEBHOOK_EVENTS.has(eventType)) {
    return {
      status: 200,
      body: {
        ok: true,
        received: true,
        persisted: false,
        ignored: true,
        eventId,
        eventType,
      },
    };
  }

  return persistStripeWebhookEvent(event, eventType);
}
