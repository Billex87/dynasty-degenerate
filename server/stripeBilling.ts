import { TRPCError } from "@trpc/server";

export const STRIPE_BILLING_PRODUCT_KEYS = [
  "pro-monthly",
  "elite-monthly",
  "league-pass-season",
  "rookie-draft-kit",
  "redraft-draft-kit",
] as const;

export type StripeBillingProductKey = typeof STRIPE_BILLING_PRODUCT_KEYS[number];

type StripeCheckoutMode = "payment" | "subscription";

type StripeBillingProductConfig = {
  priceEnvVar: string;
  mode: StripeCheckoutMode;
  productType: "subscription" | "league-pass" | "draft-kit";
  plan: string;
  requiresLeagueId?: boolean;
};

type StripeFetch = (
  input: string,
  init: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

type StripeCheckoutSessionResponse = {
  id?: unknown;
  url?: unknown;
  mode?: unknown;
};

type StripePortalSessionResponse = {
  id?: unknown;
  url?: unknown;
};

export type CreateStripeCheckoutSessionInput = {
  productKey: StripeBillingProductKey;
  userOpenId: string;
  userEmail?: string | null;
  stripeCustomerId?: string | null;
  leagueId?: string | null;
  appBaseUrl: string;
  returnPath?: string | null;
  env?: Record<string, string | undefined>;
  fetchImpl?: StripeFetch;
};

export type CreateStripeCustomerPortalSessionInput = {
  stripeCustomerId: string;
  appBaseUrl: string;
  returnPath?: string | null;
  env?: Record<string, string | undefined>;
  fetchImpl?: StripeFetch;
};

const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";

const STRIPE_BILLING_PRODUCTS: Record<StripeBillingProductKey, StripeBillingProductConfig> = {
  "pro-monthly": {
    priceEnvVar: "STRIPE_PRICE_PRO_MONTHLY",
    mode: "subscription",
    productType: "subscription",
    plan: "pro",
  },
  "elite-monthly": {
    priceEnvVar: "STRIPE_PRICE_ELITE_MONTHLY",
    mode: "subscription",
    productType: "subscription",
    plan: "elite",
  },
  "league-pass-season": {
    priceEnvVar: "STRIPE_PRICE_LEAGUE_PASS_SEASON",
    mode: "payment",
    productType: "league-pass",
    plan: "league-pass",
    requiresLeagueId: true,
  },
  "rookie-draft-kit": {
    priceEnvVar: "STRIPE_PRICE_ROOKIE_DRAFT_KIT",
    mode: "payment",
    productType: "draft-kit",
    plan: "one-time",
  },
  "redraft-draft-kit": {
    priceEnvVar: "STRIPE_PRICE_REDRAFT_DRAFT_KIT",
    mode: "payment",
    productType: "draft-kit",
    plan: "one-time",
  },
};

function requiredTrimmed(value: string | null | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${label} is required for Stripe billing.`,
    });
  }
  return normalized;
}

function getStripeSecretKey(env: Record<string, string | undefined>): string {
  return requiredTrimmed(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
}

function getProductConfig(productKey: StripeBillingProductKey): StripeBillingProductConfig {
  return STRIPE_BILLING_PRODUCTS[productKey];
}

function getProductPriceId(productKey: StripeBillingProductKey, env: Record<string, string | undefined>): string {
  const config = getProductConfig(productKey);
  return requiredTrimmed(env[config.priceEnvVar], config.priceEnvVar);
}

function normalizeReturnPath(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  return trimmed.slice(0, 512);
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

export function resolveStripeBillingAppBaseUrl(input: {
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
      message: "Stripe billing requires APP_BASE_URL in production.",
    });
  }

  const host = requiredTrimmed(input.requestHost, "request host");
  const protocol = input.requestProtocol?.trim() || "http";
  return normalizeAppBaseUrl(`${protocol}://${host}`);
}

function buildUrlWithBillingState(
  appBaseUrl: string,
  returnPath: string | null | undefined,
  state: "success" | "cancelled" | "portal",
  productKey?: StripeBillingProductKey
): string {
  const normalizedReturnPath = normalizeReturnPath(returnPath);
  const hasQuery = normalizedReturnPath.includes("?");
  const productParam = productKey ? `&product=${encodeURIComponent(productKey)}` : "";
  const sessionParam = state === "success" ? "&session_id={CHECKOUT_SESSION_ID}" : "";
  return `${normalizeAppBaseUrl(appBaseUrl)}${normalizedReturnPath}${hasQuery ? "&" : "?"}billing=${state}${productParam}${sessionParam}`;
}

function appendMetadata(params: URLSearchParams, prefix: string, metadata: Record<string, string>) {
  for (const [key, value] of Object.entries(metadata)) {
    params.append(`${prefix}[${key}]`, value);
  }
}

function safeStripeErrorMessage(endpoint: string, status: number): string {
  return `Stripe billing request failed for ${endpoint} with status ${status}.`;
}

async function postStripeForm(
  endpoint: "/checkout/sessions" | "/billing_portal/sessions",
  params: URLSearchParams,
  secretKey: string,
  fetchImpl: StripeFetch = fetch
): Promise<unknown> {
  const response = await fetchImpl(`${STRIPE_API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
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
      message: safeStripeErrorMessage(endpoint, response.status),
    });
  }

  return payload;
}

export async function createStripeCheckoutSession(input: CreateStripeCheckoutSessionInput) {
  const env = input.env ?? process.env;
  const secretKey = getStripeSecretKey(env);
  const config = getProductConfig(input.productKey);
  const priceId = getProductPriceId(input.productKey, env);
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const leagueId = input.leagueId?.trim() || null;

  if (config.requiresLeagueId && !leagueId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A league ID is required for league-pass checkout.",
    });
  }

  const metadata = {
    userOpenId,
    productKey: input.productKey,
    productType: config.productType,
    plan: config.plan,
    ...(leagueId ? { leagueId } : {}),
  };

  const params = new URLSearchParams();
  params.append("mode", config.mode);
  params.append("line_items[0][price]", priceId);
  params.append("line_items[0][quantity]", "1");
  params.append("success_url", buildUrlWithBillingState(input.appBaseUrl, input.returnPath, "success", input.productKey));
  params.append("cancel_url", buildUrlWithBillingState(input.appBaseUrl, input.returnPath, "cancelled", input.productKey));
  params.append("client_reference_id", userOpenId);
  appendMetadata(params, "metadata", metadata);

  const stripeCustomerId = input.stripeCustomerId?.trim();
  if (stripeCustomerId) {
    params.append("customer", stripeCustomerId);
  } else if (input.userEmail?.trim()) {
    params.append("customer_email", input.userEmail.trim());
  }

  if (config.mode === "subscription") {
    appendMetadata(params, "subscription_data[metadata]", metadata);
  } else {
    if (!stripeCustomerId) {
      params.append("customer_creation", "always");
    }
    appendMetadata(params, "payment_intent_data[metadata]", metadata);
  }

  const payload = await postStripeForm("/checkout/sessions", params, secretKey, input.fetchImpl);
  const session = payload as StripeCheckoutSessionResponse;
  if (typeof session.id !== "string" || typeof session.url !== "string") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe checkout did not return a hosted session URL.",
    });
  }

  return {
    id: session.id,
    url: session.url,
    mode: config.mode,
    productKey: input.productKey,
  } as const;
}

export async function createStripeCustomerPortalSession(input: CreateStripeCustomerPortalSessionInput) {
  const env = input.env ?? process.env;
  const secretKey = getStripeSecretKey(env);
  const stripeCustomerId = requiredTrimmed(input.stripeCustomerId, "stripeCustomerId");
  const params = new URLSearchParams();
  params.append("customer", stripeCustomerId);
  params.append("return_url", buildUrlWithBillingState(input.appBaseUrl, input.returnPath, "portal"));

  const portalConfigurationId = env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID?.trim();
  if (portalConfigurationId) {
    params.append("configuration", portalConfigurationId);
  }

  const payload = await postStripeForm("/billing_portal/sessions", params, secretKey, input.fetchImpl);
  const session = payload as StripePortalSessionResponse;
  if (typeof session.id !== "string" || typeof session.url !== "string") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe customer portal did not return a hosted session URL.",
    });
  }

  return {
    id: session.id,
    url: session.url,
  } as const;
}
