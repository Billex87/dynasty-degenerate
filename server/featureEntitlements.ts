import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import {
  listActiveFeatureEntitlementsForLeague,
  listActiveFeatureEntitlementsForUser,
  listActiveLeaguePassesForLeague,
  listBillingSubscriptionsForUser,
} from "./db";

export type BillingPlan = "free" | "pro" | "elite" | "admin";

export type PaidFeatureKey =
  | "free-sleeper-report"
  | "monthly-roster-blueprint"
  | "unlimited-reports"
  | "multi-league-portfolio"
  | "ai-confidence-history"
  | "source-trace-details"
  | "anomaly-alerts"
  | "exports"
  | "draft-kit-tools"
  | "admin-diagnostics";

type EntitlementUser = Pick<User, "id" | "openId" | "email" | "name" | "role"> | null | undefined;

type UsageLimit = {
  period: "day" | "month" | "season";
  limit: number;
};

type BillingSubscriptionAccess = {
  plan: string | null | undefined;
  status: string;
  currentPeriodEnd?: Date | string | null;
};

type PersistedFeatureEntitlementAccess = {
  subjectType?: string | null;
  userOpenId?: string | null;
  leagueId?: string | null;
  featureKey: string;
  status: string;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

type PersistedLeaguePassAccess = {
  leagueId?: string | null;
  status: string;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

type FeaturePolicy = {
  minimumPlan: BillingPlan;
  launchState: "active" | "paid-not-launched" | "admin-only";
  usageLimit?: UsageLimit;
};

const PLAN_RANK: Record<BillingPlan, number> = {
  free: 0,
  pro: 1,
  elite: 2,
  admin: 3,
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const ACTIVE_FEATURE_ENTITLEMENT_STATUSES = new Set(["active"]);
const BILLING_SUBSCRIPTION_PLANS = new Set<BillingPlan>(["free", "pro", "elite"]);
const LEAGUE_PASS_FEATURE_KEYS = new Set<PaidFeatureKey>([
  "source-trace-details",
  "ai-confidence-history",
  "exports",
]);

const FEATURE_POLICIES: Record<PaidFeatureKey, FeaturePolicy> = {
  "free-sleeper-report": {
    minimumPlan: "free",
    launchState: "active",
  },
  "monthly-roster-blueprint": {
    minimumPlan: "free",
    launchState: "active",
    usageLimit: { period: "month", limit: 1 },
  },
  "unlimited-reports": {
    minimumPlan: "pro",
    launchState: "paid-not-launched",
  },
  "multi-league-portfolio": {
    minimumPlan: "pro",
    launchState: "paid-not-launched",
  },
  "ai-confidence-history": {
    minimumPlan: "pro",
    launchState: "paid-not-launched",
  },
  "source-trace-details": {
    minimumPlan: "pro",
    launchState: "paid-not-launched",
  },
  "anomaly-alerts": {
    minimumPlan: "elite",
    launchState: "paid-not-launched",
  },
  exports: {
    minimumPlan: "pro",
    launchState: "paid-not-launched",
  },
  "draft-kit-tools": {
    minimumPlan: "pro",
    launchState: "paid-not-launched",
  },
  "admin-diagnostics": {
    minimumPlan: "admin",
    launchState: "admin-only",
  },
};

export type FeatureEntitlementResult = {
  allowed: boolean;
  feature: PaidFeatureKey;
  plan: BillingPlan;
  requiredPlan: BillingPlan;
  launchState: FeaturePolicy["launchState"];
  usageLimit: UsageLimit | null;
  reason: string;
};

export type CanUseFeatureInput = {
  user?: EntitlementUser;
  feature: PaidFeatureKey;
  leagueId?: string | null;
  plan?: BillingPlan | null;
  subscriptions?: BillingSubscriptionAccess[];
  entitlements?: PersistedFeatureEntitlementAccess[];
  leaguePasses?: PersistedLeaguePassAccess[];
  paidFeaturesEnabled?: boolean;
};

function isPaidFeatureLaunchEnabled(input: CanUseFeatureInput): boolean {
  return input.paidFeaturesEnabled ?? process.env.ENABLE_PAID_FEATURES === "true";
}

function isDateInFuture(value: Date | string | null | undefined, now: Date): boolean {
  if (!value) return true;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > now.getTime();
}

function normalizeBillingSubscriptionPlan(plan: string | null | undefined): BillingPlan | null {
  if (!plan) return null;
  const normalized = plan.trim().toLowerCase() as BillingPlan;
  return BILLING_SUBSCRIPTION_PLANS.has(normalized) ? normalized : null;
}

function isDateStarted(value: Date | string | null | undefined, now: Date): boolean {
  if (!value) return true;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() <= now.getTime();
}

function hasActivePersistedFeatureEntitlement(
  input: CanUseFeatureInput,
  now = new Date()
): boolean {
  if (input.feature === "admin-diagnostics") return false;

  return (input.entitlements || []).some((entitlement) => {
    if (entitlement.featureKey !== input.feature) return false;
    if (!ACTIVE_FEATURE_ENTITLEMENT_STATUSES.has(entitlement.status.trim().toLowerCase())) return false;
    if (!isDateStarted(entitlement.startsAt, now)) return false;
    if (!isDateInFuture(entitlement.expiresAt, now)) return false;

    const entitlementLeagueId = entitlement.leagueId?.trim();
    if (!entitlementLeagueId) return true;
    return Boolean(input.leagueId && entitlementLeagueId === input.leagueId);
  });
}

function hasActivePersistedLeaguePass(
  input: CanUseFeatureInput,
  now = new Date()
): boolean {
  if (!input.leagueId || !LEAGUE_PASS_FEATURE_KEYS.has(input.feature)) return false;

  return (input.leaguePasses || []).some((leaguePass) => {
    if (!ACTIVE_FEATURE_ENTITLEMENT_STATUSES.has(leaguePass.status.trim().toLowerCase())) return false;
    if (!isDateStarted(leaguePass.startsAt, now)) return false;
    if (!isDateInFuture(leaguePass.expiresAt, now)) return false;
    const leaguePassLeagueId = leaguePass.leagueId?.trim();
    return !leaguePassLeagueId || leaguePassLeagueId === input.leagueId;
  });
}

export function getUserBillingPlan(
  user?: EntitlementUser,
  explicitPlan?: BillingPlan | null,
  subscriptions: BillingSubscriptionAccess[] = [],
  now = new Date()
): BillingPlan {
  if (explicitPlan) return explicitPlan;
  if (user?.role === "admin") return "admin";

  return subscriptions.reduce<BillingPlan>((bestPlan, subscription) => {
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) return bestPlan;
    if (!isDateInFuture(subscription.currentPeriodEnd, now)) return bestPlan;
    const subscriptionPlan = normalizeBillingSubscriptionPlan(subscription.plan);
    if (!subscriptionPlan || PLAN_RANK[subscriptionPlan] <= PLAN_RANK[bestPlan]) return bestPlan;
    return subscriptionPlan;
  }, "free");
}

export function canUseFeature(input: CanUseFeatureInput): FeatureEntitlementResult {
  const policy = FEATURE_POLICIES[input.feature];
  const plan = getUserBillingPlan(input.user, input.plan, input.subscriptions);
  const usageLimit = policy.usageLimit ?? null;

  if (policy.launchState === "paid-not-launched" && !isPaidFeatureLaunchEnabled(input)) {
    return {
      allowed: false,
      feature: input.feature,
      plan,
      requiredPlan: policy.minimumPlan,
      launchState: policy.launchState,
      usageLimit,
      reason: "Paid features are not launched yet.",
    };
  }

  if (PLAN_RANK[plan] < PLAN_RANK[policy.minimumPlan]) {
    if (hasActivePersistedFeatureEntitlement(input) || hasActivePersistedLeaguePass(input)) {
      return {
        allowed: true,
        feature: input.feature,
        plan,
        requiredPlan: policy.minimumPlan,
        launchState: policy.launchState,
        usageLimit,
        reason: "Allowed by persisted feature entitlement.",
      };
    }

    return {
      allowed: false,
      feature: input.feature,
      plan,
      requiredPlan: policy.minimumPlan,
      launchState: policy.launchState,
      usageLimit,
      reason: `The ${input.feature} feature requires the ${policy.minimumPlan} plan.`,
    };
  }

  return {
    allowed: true,
    feature: input.feature,
    plan,
    requiredPlan: policy.minimumPlan,
    launchState: policy.launchState,
    usageLimit,
    reason: usageLimit
      ? `Allowed with ${usageLimit.limit} use per ${usageLimit.period}.`
      : "Allowed by entitlement policy.",
  };
}

export function assertCanUseFeature(input: CanUseFeatureInput): FeatureEntitlementResult {
  const entitlement = canUseFeature(input);
  if (entitlement.allowed) return entitlement;

  throw new TRPCError({
    code: "FORBIDDEN",
    message: entitlement.reason,
  });
}

export async function loadPersistedFeatureAccess(input: {
  user?: EntitlementUser;
  leagueId?: string | null;
}) {
  const userOpenId = input.user?.openId;
  const leagueId = input.leagueId?.trim() || null;

  const [
    subscriptions,
    userEntitlements,
    leagueEntitlements,
    leaguePasses,
  ] = await Promise.all([
    userOpenId ? listBillingSubscriptionsForUser(userOpenId) : Promise.resolve([]),
    userOpenId ? listActiveFeatureEntitlementsForUser(userOpenId) : Promise.resolve([]),
    leagueId ? listActiveFeatureEntitlementsForLeague(leagueId) : Promise.resolve([]),
    leagueId ? listActiveLeaguePassesForLeague(leagueId) : Promise.resolve([]),
  ]);

  return {
    subscriptions,
    entitlements: [...userEntitlements, ...leagueEntitlements],
    leaguePasses,
  };
}

export async function canUsePersistedFeature(input: Omit<CanUseFeatureInput, "subscriptions" | "entitlements" | "leaguePasses">): Promise<FeatureEntitlementResult> {
  const persistedAccess = await loadPersistedFeatureAccess({
    user: input.user,
    leagueId: input.leagueId,
  });

  return canUseFeature({
    ...input,
    ...persistedAccess,
  });
}

export async function assertCanUsePersistedFeature(input: Omit<CanUseFeatureInput, "subscriptions" | "entitlements" | "leaguePasses">): Promise<FeatureEntitlementResult> {
  const entitlement = await canUsePersistedFeature(input);
  if (entitlement.allowed) return entitlement;

  throw new TRPCError({
    code: "FORBIDDEN",
    message: entitlement.reason,
  });
}
