import { TRPCError } from "@trpc/server";

const RESEND_EMAIL_API_URL = "https://api.resend.com/emails";

type TransactionalEmailFetch = (
  input: string,
  init: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey?: string | null;
  env?: Record<string, string | undefined>;
  fetchImpl?: TransactionalEmailFetch;
};

export type SendMagicLinkEmailInput = {
  email: string;
  token: string;
  tokenId: string;
  redirectPath?: string | null;
  expiresAt: Date;
  appBaseUrl: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: TransactionalEmailFetch;
};

export type BillingNotificationKind = "payment-failed" | "subscription-canceled";

export type SendBillingNotificationEmailInput = {
  email: string;
  kind: BillingNotificationKind;
  plan?: string | null;
  appBaseUrl: string;
  eventId?: string | null;
  eventType?: string | null;
  env?: Record<string, string | undefined>;
  fetchImpl?: TransactionalEmailFetch;
};

type ResendEmailResponse = {
  id?: unknown;
};

function requiredTrimmed(value: string | null | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${label} is required for transactional email.`,
    });
  }
  return normalized;
}

function normalizeAppBaseUrl(appBaseUrl: string): string {
  const url = new URL(requiredTrimmed(appBaseUrl, "APP_BASE_URL"));
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "APP_BASE_URL must use http or https.",
    });
  }
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizeReturnPath(redirectPath: string | null | undefined): string {
  const trimmed = String(redirectPath || "").trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return "/";
  return trimmed.slice(0, 512);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeEmailFailureMessage(status: number): string {
  return `Transactional email request failed with status ${status}.`;
}

export function isTransactionalEmailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.TRANSACTIONAL_EMAIL_FROM?.trim());
}

export function assertTransactionalEmailConfiguredForProduction(input: {
  env?: Record<string, string | undefined>;
  nodeEnv?: string | null;
} = {}) {
  const env = input.env ?? process.env;
  if ((input.nodeEnv ?? env.NODE_ENV) === "production" && !isTransactionalEmailConfigured(env)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Magic-link email delivery requires RESEND_API_KEY and TRANSACTIONAL_EMAIL_FROM in production.",
    });
  }
}

export function resolveTransactionalEmailAppBaseUrl(input: {
  env?: Record<string, string | undefined>;
  nodeEnv?: string | null;
  requestProtocol?: string | null;
  requestHost?: string | null;
}): string {
  const env = input.env ?? process.env;
  const configuredBaseUrl = env.APP_BASE_URL?.trim();
  if (configuredBaseUrl) return normalizeAppBaseUrl(configuredBaseUrl);

  if ((input.nodeEnv ?? env.NODE_ENV) === "production") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Magic-link email delivery requires APP_BASE_URL in production.",
    });
  }

  const host = requiredTrimmed(input.requestHost, "request host");
  const protocol = input.requestProtocol?.trim() || "http";
  return normalizeAppBaseUrl(`${protocol}://${host}`);
}

export function buildMagicLinkUrl(input: {
  appBaseUrl: string;
  email: string;
  token: string;
  redirectPath?: string | null;
}): string {
  const url = new URL(`${normalizeAppBaseUrl(input.appBaseUrl)}/auth/magic-link`);
  url.searchParams.set("email", input.email);
  url.searchParams.set("token", input.token);
  url.searchParams.set("redirectPath", normalizeReturnPath(input.redirectPath));
  return url.toString();
}

export function buildMagicLinkEmail(input: {
  email: string;
  magicLinkUrl: string;
  expiresAt: Date;
}) {
  const escapedUrl = escapeHtml(input.magicLinkUrl);
  const expiresAtLabel = input.expiresAt.toISOString();

  return {
    subject: "Sign in to Dynasty Degens",
    text: [
      "Sign in to Dynasty Degens with this magic link:",
      input.magicLinkUrl,
      "",
      `This link expires at ${expiresAtLabel}.`,
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: [
      "<p>Sign in to Dynasty Degens with this magic link:</p>",
      `<p><a href="${escapedUrl}">Sign in to Dynasty Degens</a></p>`,
      `<p>This link expires at ${escapeHtml(expiresAtLabel)}.</p>`,
      "<p>If you did not request this, you can ignore this email.</p>",
    ].join(""),
  };
}

export function buildBillingNotificationEmail(input: {
  kind: BillingNotificationKind;
  plan?: string | null;
  appBaseUrl: string;
}) {
  const appBaseUrl = normalizeAppBaseUrl(input.appBaseUrl);
  const supportUrl = `${appBaseUrl}/support`;
  const escapedSupportUrl = escapeHtml(supportUrl);
  const planLabel = input.plan?.trim() || "paid";

  if (input.kind === "subscription-canceled") {
    return {
      subject: "Your Dynasty Degens subscription was canceled",
      text: [
        `Your Dynasty Degens ${planLabel} subscription has been canceled.`,
        "If this was expected, no action is needed.",
        `If you need help, contact support: ${supportUrl}`,
      ].join("\n"),
      html: [
        `<p>Your Dynasty Degens ${escapeHtml(planLabel)} subscription has been canceled.</p>`,
        "<p>If this was expected, no action is needed.</p>",
        `<p>If you need help, contact support: <a href="${escapedSupportUrl}">${escapedSupportUrl}</a></p>`,
      ].join(""),
    };
  }

  return {
    subject: "Payment failed for Dynasty Degens",
    text: [
      `We could not process the latest payment for your Dynasty Degens ${planLabel} subscription.`,
      "Your paid access may be interrupted if the payment is not updated.",
      `Need help? Contact support: ${supportUrl}`,
    ].join("\n"),
    html: [
      `<p>We could not process the latest payment for your Dynasty Degens ${escapeHtml(planLabel)} subscription.</p>`,
      "<p>Your paid access may be interrupted if the payment is not updated.</p>",
      `<p>Need help? Contact support: <a href="${escapedSupportUrl}">${escapedSupportUrl}</a></p>`,
    ].join(""),
  };
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const env = input.env ?? process.env;
  const apiKey = requiredTrimmed(env.RESEND_API_KEY, "RESEND_API_KEY");
  const from = requiredTrimmed(env.TRANSACTIONAL_EMAIL_FROM, "TRANSACTIONAL_EMAIL_FROM");
  const replyTo = env.TRANSACTIONAL_EMAIL_REPLY_TO?.trim();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const idempotencyKey = input.idempotencyKey?.trim();
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);

  const response = await (input.fetchImpl ?? fetch)(RESEND_EMAIL_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: [requiredTrimmed(input.to, "to")],
      subject: requiredTrimmed(input.subject, "subject"),
      text: input.text,
      html: input.html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: safeEmailFailureMessage(response.status),
    });
  }

  const email = payload as ResendEmailResponse;
  if (typeof email.id !== "string") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Transactional email provider did not return a message ID.",
    });
  }

  return { id: email.id };
}

export async function sendMagicLinkEmail(input: SendMagicLinkEmailInput) {
  const magicLinkUrl = buildMagicLinkUrl({
    appBaseUrl: input.appBaseUrl,
    email: input.email,
    token: input.token,
    redirectPath: input.redirectPath,
  });
  const email = buildMagicLinkEmail({
    email: input.email,
    magicLinkUrl,
    expiresAt: input.expiresAt,
  });

  return sendTransactionalEmail({
    to: input.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    idempotencyKey: `magic-link/${input.tokenId}`,
    env: input.env,
    fetchImpl: input.fetchImpl,
  });
}

export async function sendBillingNotificationEmail(input: SendBillingNotificationEmailInput) {
  const email = buildBillingNotificationEmail({
    kind: input.kind,
    plan: input.plan,
    appBaseUrl: input.appBaseUrl,
  });
  const eventKey = [input.eventType, input.eventId].filter(Boolean).join("/");

  return sendTransactionalEmail({
    to: input.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    idempotencyKey: eventKey ? `billing/${eventKey}` : `billing/${input.kind}`,
    env: input.env,
    fetchImpl: input.fetchImpl,
  });
}
