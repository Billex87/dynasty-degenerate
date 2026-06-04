import { describe, expect, it } from "vitest";
import {
  evaluateOperationsSecurityReadiness,
  getOperationsSecurityBlockers,
} from "./operationsSecurityReadiness";

describe("operations security readiness", () => {
  it("flags production blockers without printing secret values", () => {
    const readiness = evaluateOperationsSecurityReadiness({
      NODE_ENV: "production",
      JWT_SECRET: "",
      DATABASE_URL: "postgres://secret-user:secret-pass@example.com/db",
      ADMIN_LOGIN_PASSWORD: "",
      CRON_SECRET: "",
      RESEND_API_KEY: "",
      TRANSACTIONAL_EMAIL_FROM: "",
      APP_BASE_URL: "",
    });

    expect(readiness.totals.blocker).toBeGreaterThan(0);
    expect(readiness.checks.find((check) => check.id === "production-session-secret")).toMatchObject({
      status: "blocker",
      envNames: ["JWT_SECRET"],
    });
    expect(JSON.stringify(readiness)).not.toContain("secret-pass");
  });

  it("requires full Stripe production config only when paid launch is enabled", () => {
    const unpaid = evaluateOperationsSecurityReadiness({
      NODE_ENV: "production",
      JWT_SECRET: "configured",
      DATABASE_URL: "configured",
      ADMIN_LOGIN_PASSWORD: "configured",
      CRON_SECRET: "configured",
      RESEND_API_KEY: "configured",
      TRANSACTIONAL_EMAIL_FROM: "login@example.com",
      APP_BASE_URL: "https://dynastydegens.com",
    });

    expect(unpaid.checks.find((check) => check.id === "stripe-checkout-production")?.status).toBe("pass");

    const paidBlockers = getOperationsSecurityBlockers({
      NODE_ENV: "production",
      ENABLE_PAID_FEATURES: "true",
      JWT_SECRET: "configured",
      DATABASE_URL: "configured",
      ADMIN_LOGIN_PASSWORD: "configured",
      CRON_SECRET: "configured",
      RESEND_API_KEY: "configured",
      TRANSACTIONAL_EMAIL_FROM: "login@example.com",
      APP_BASE_URL: "https://dynastydegens.com",
      STRIPE_SECRET_KEY: "configured",
      STRIPE_WEBHOOK_SECRET: "configured",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro",
    });

    expect(paidBlockers.some((check) => check.id === "stripe-checkout-production")).toBe(true);
  });

  it("blocks unsafe source-health webhook URLs in production", () => {
    const readiness = evaluateOperationsSecurityReadiness({
      NODE_ENV: "production",
      JWT_SECRET: "configured",
      DATABASE_URL: "configured",
      ADMIN_LOGIN_PASSWORD: "configured",
      CRON_SECRET: "configured",
      RESEND_API_KEY: "configured",
      TRANSACTIONAL_EMAIL_FROM: "login@example.com",
      APP_BASE_URL: "https://dynastydegens.com",
      SOURCE_HEALTH_ALERT_WEBHOOK_URL: "http://127.0.0.1:3000/hook",
      SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL: "warn",
    });

    expect(readiness.checks.find((check) => check.id === "source-health-alert-webhook-url-safe")).toMatchObject({
      status: "blocker",
      envNames: ["SOURCE_HEALTH_ALERT_WEBHOOK_URL"],
    });
  });

  it("passes configured production security posture", () => {
    const readiness = evaluateOperationsSecurityReadiness({
      NODE_ENV: "production",
      ENABLE_PAID_FEATURES: "true",
      JWT_SECRET: "configured",
      DATABASE_URL: "configured",
      ADMIN_LOGIN_PASSWORD: "configured",
      CRON_SECRET: "configured",
      RESEND_API_KEY: "configured",
      TRANSACTIONAL_EMAIL_FROM: "login@example.com",
      APP_BASE_URL: "https://dynastydegens.com",
      STRIPE_SECRET_KEY: "configured",
      STRIPE_WEBHOOK_SECRET: "configured",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro",
      STRIPE_PRICE_ELITE_MONTHLY: "price_elite",
      STRIPE_PRICE_LEAGUE_PASS_SEASON: "price_league",
      STRIPE_PRICE_ROOKIE_DRAFT_KIT: "price_rookie",
      STRIPE_PRICE_REDRAFT_DRAFT_KIT: "price_redraft",
      SOURCE_HEALTH_ALERT_WEBHOOK_URL: "https://hooks.slack.com/services/test",
      SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL: "danger",
    });

    expect(readiness.totals.blocker).toBe(0);
  });
});
