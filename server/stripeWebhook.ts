import crypto from "node:crypto";

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

function verificationReasonToStatus(reason: StripeWebhookVerificationFailureReason): number {
  return reason === "missing-secret" ? 500 : 400;
}

export function handleStripeWebhookPayload(input: StripeWebhookVerificationInput): StripeWebhookRouteResult {
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

  const eventId = getObjectStringValue(parsedPayload, "id");
  const eventType = getObjectStringValue(parsedPayload, "type");
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

  return {
    status: 501,
    body: {
      ok: false,
      received: true,
      persisted: false,
      eventId,
      eventType,
      error: "webhook-upsert-not-implemented",
    },
  };
}
