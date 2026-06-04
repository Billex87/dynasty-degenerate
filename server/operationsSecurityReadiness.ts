type Env = Record<string, string | undefined>;

export type OperationsSecurityCheckStatus = "pass" | "warn" | "blocker";

export type OperationsSecurityCheck = {
  id: string;
  status: OperationsSecurityCheckStatus;
  envNames: string[];
  message: string;
};

export type OperationsSecurityReadiness = {
  generatedAt: string;
  production: boolean;
  totals: Record<OperationsSecurityCheckStatus, number>;
  checks: OperationsSecurityCheck[];
};

const STRIPE_PRICE_ENV_NAMES = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_ELITE_MONTHLY",
  "STRIPE_PRICE_LEAGUE_PASS_SEASON",
  "STRIPE_PRICE_ROOKIE_DRAFT_KIT",
  "STRIPE_PRICE_REDRAFT_DRAFT_KIT",
];

const FANTASYPROS_FLAG_NAMES = [
  "ENABLE_REDRAFT_FANTASYPROS",
  "ENABLE_FANTASYPROS_DRAFT_RANKINGS",
  "ENABLE_FANTASYPROS_ROS_RANKINGS",
  "ENABLE_FANTASYPROS_DYNASTY_RANKINGS",
  "ENABLE_FANTASYPROS_DEVY_RANKINGS",
  "ENABLE_FANTASYPROS_ROOKIE_RANKINGS",
  "ENABLE_FANTASYPROS_ADP_RANKINGS",
  "ENABLE_FANTASYPROS_PROJECTIONS",
  "ENABLE_FANTASYPROS_INJURIES",
  "ENABLE_FANTASYPROS_NEWS",
  "ENABLE_FANTASYPROS_PLAYER_POINTS",
  "ENABLE_FANTASYPROS_EXPANDED_HEALTH",
  "ENABLE_FANTASYPROS_ENDPOINT_SNAPSHOTS",
  "ENABLE_FANTASYPROS_EXPANDED_SNAPSHOTS",
];

function hasValue(env: Env, name: string): boolean {
  return Boolean(env[name]?.trim());
}

function isTruthy(value: string | undefined): boolean {
  return /^(?:1|true|yes|on)$/i.test(String(value || "").trim());
}

function isProduction(env: Env): boolean {
  return env.NODE_ENV === "production";
}

function checkRequired(input: {
  id: string;
  env: Env;
  envNames: string[];
  required: boolean;
  message: string;
  missingMessage: string;
  missingStatus?: OperationsSecurityCheckStatus;
}): OperationsSecurityCheck {
  const missing = input.envNames.filter((name) => !hasValue(input.env, name));
  if (!input.required || missing.length === 0) {
    return {
      id: input.id,
      status: "pass",
      envNames: input.envNames,
      message: input.message,
    };
  }

  return {
    id: input.id,
    status: input.missingStatus ?? "blocker",
    envNames: missing,
    message: input.missingMessage,
  };
}

function validateWebhookUrl(env: Env): OperationsSecurityCheck {
  const envNames = ["SOURCE_HEALTH_ALERT_WEBHOOK_URL", "SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL"];
  const configuredUrl = env.SOURCE_HEALTH_ALERT_WEBHOOK_URL?.trim();
  const minLevel = String(env.SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL || "warn").trim().toLowerCase();
  const allowedLevels = new Set(["info", "warn", "danger"]);

  if (!configuredUrl) {
    return {
      id: "source-health-alert-webhook-configured",
      status: "warn",
      envNames: ["SOURCE_HEALTH_ALERT_WEBHOOK_URL"],
      message: "Source-health webhook delivery is not configured.",
    };
  }

  try {
    const url = new URL(configuredUrl);
    const host = url.hostname.toLowerCase();
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    const isPrivateHost =
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

    if (isProduction(env) && url.protocol !== "https:") {
      return {
        id: "source-health-alert-webhook-url-safe",
        status: "blocker",
        envNames: ["SOURCE_HEALTH_ALERT_WEBHOOK_URL"],
        message: "Production source-health webhook URL must use https.",
      };
    }

    if (isProduction(env) && (isLocalHost || isPrivateHost)) {
      return {
        id: "source-health-alert-webhook-url-safe",
        status: "blocker",
        envNames: ["SOURCE_HEALTH_ALERT_WEBHOOK_URL"],
        message: "Production source-health webhook URL must not target localhost or private network hosts.",
      };
    }

    if (!allowedLevels.has(minLevel)) {
      return {
        id: "source-health-alert-webhook-min-level",
        status: "warn",
        envNames,
        message: "SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL should be info, warn, or danger.",
      };
    }

    return {
      id: "source-health-alert-webhook-configured",
      status: "pass",
      envNames,
      message: "Source-health webhook delivery is configured with a safe URL shape.",
    };
  } catch {
    return {
      id: "source-health-alert-webhook-url-safe",
      status: "blocker",
      envNames: ["SOURCE_HEALTH_ALERT_WEBHOOK_URL"],
      message: "Source-health webhook URL is not a valid URL.",
    };
  }
}

function anyEnabled(env: Env, names: string[]): boolean {
  return names.some((name) => isTruthy(env[name]));
}

function buildChecks(env: Env): OperationsSecurityCheck[] {
  const production = isProduction(env);
  const paidFeaturesEnabled = isTruthy(env.ENABLE_PAID_FEATURES);
  const stripeConfigured = hasValue(env, "STRIPE_SECRET_KEY") || hasValue(env, "STRIPE_WEBHOOK_SECRET");
  const anyStripePriceConfigured = STRIPE_PRICE_ENV_NAMES.some((name) => hasValue(env, name));

  return [
    checkRequired({
      id: "production-session-secret",
      env,
      envNames: ["JWT_SECRET"],
      required: production,
      message: "Production session signing secret is configured.",
      missingMessage: "Production auth requires JWT_SECRET.",
    }),
    checkRequired({
      id: "production-database",
      env,
      envNames: ["DATABASE_URL"],
      required: production,
      message: "Production database URL is configured.",
      missingMessage: "Production auth, billing, usage, and diagnostics require DATABASE_URL.",
    }),
    checkRequired({
      id: "production-admin-passphrase",
      env,
      envNames: ["ADMIN_LOGIN_PASSWORD"],
      required: production && !hasValue(env, "ADMIN_PASSWORD"),
      message: "Production admin passphrase is configured.",
      missingMessage: "Production admin login requires ADMIN_LOGIN_PASSWORD.",
    }),
    checkRequired({
      id: "production-cron-secret",
      env,
      envNames: ["CRON_SECRET"],
      required: production,
      message: "Production cron secret is configured.",
      missingMessage: "Production cron routes require CRON_SECRET.",
    }),
    checkRequired({
      id: "magic-link-email-production",
      env,
      envNames: ["RESEND_API_KEY", "TRANSACTIONAL_EMAIL_FROM", "APP_BASE_URL"],
      required: production,
      message: "Production magic-link email prerequisites are configured.",
      missingMessage: "Production passwordless auth requires RESEND_API_KEY, TRANSACTIONAL_EMAIL_FROM, and APP_BASE_URL.",
    }),
    checkRequired({
      id: "stripe-webhook-secret",
      env,
      envNames: ["STRIPE_WEBHOOK_SECRET"],
      required: production && (paidFeaturesEnabled || stripeConfigured || anyStripePriceConfigured),
      message: "Stripe webhook secret is configured when billing is active.",
      missingMessage: "Stripe webhook handling requires STRIPE_WEBHOOK_SECRET before billing traffic is accepted.",
    }),
    checkRequired({
      id: "stripe-checkout-production",
      env,
      envNames: ["STRIPE_SECRET_KEY", "APP_BASE_URL", ...STRIPE_PRICE_ENV_NAMES],
      required: production && paidFeaturesEnabled,
      message: "Stripe checkout prerequisites are configured for paid launch.",
      missingMessage: "Paid feature launch requires Stripe secret, app base URL, and product price env vars.",
    }),
    checkRequired({
      id: "opticodds-props-key",
      env,
      envNames: ["OPTICODDS_API_KEY"],
      required: anyEnabled(env, ["ENABLE_OPTICODDS_PLAYER_PROPS"]),
      message: "OpticOdds props are disabled or have a server-side key.",
      missingMessage: "ENABLE_OPTICODDS_PLAYER_PROPS requires OPTICODDS_API_KEY.",
    }),
    checkRequired({
      id: "draftsharks-approved-access",
      env,
      envNames: ["DRAFTSHARKS_API_KEY", "DRAFTSHARKS_SOS_URL"],
      required: anyEnabled(env, ["ENABLE_DRAFTSHARKS_SOS", "ENABLE_DRAFTSHARKS_PROJECTIONS"]),
      message: "DraftSharks features are disabled or have approved-access configuration.",
      missingMessage: "DraftSharks SOS/projection flags require DRAFTSHARKS_API_KEY and DRAFTSHARKS_SOS_URL.",
    }),
    checkRequired({
      id: "fantasypros-api-key",
      env,
      envNames: ["FANTASYPROS_API_KEY"],
      required: anyEnabled(env, FANTASYPROS_FLAG_NAMES),
      message: "FantasyPros features are disabled or have a server-side API key.",
      missingMessage: "Enabled FantasyPros feature flags require FANTASYPROS_API_KEY.",
    }),
    checkRequired({
      id: "fantasy-nerds-api-key",
      env,
      envNames: ["FANTASY_NERDS_API_KEY"],
      required: production && anyEnabled(env, ["ENABLE_FANTASY_NERDS_PROJECTIONS", "ENABLE_REDRAFT_FANTASY_NERDS"]),
      message: "Fantasy Nerds production features are disabled or have a server-side API key.",
      missingMessage: "Production Fantasy Nerds feature flags require FANTASY_NERDS_API_KEY.",
    }),
    validateWebhookUrl(env),
  ];
}

export function evaluateOperationsSecurityReadiness(env: Env = process.env): OperationsSecurityReadiness {
  const checks = buildChecks(env);
  const totals = checks.reduce<Record<OperationsSecurityCheckStatus, number>>(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, blocker: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    production: isProduction(env),
    totals,
    checks,
  };
}

export function getOperationsSecurityBlockers(env: Env = process.env): OperationsSecurityCheck[] {
  return evaluateOperationsSecurityReadiness(env).checks.filter((check) => check.status === "blocker");
}
