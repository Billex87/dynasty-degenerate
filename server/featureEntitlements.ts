import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";

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

type CanUseFeatureInput = {
  user?: EntitlementUser;
  feature: PaidFeatureKey;
  leagueId?: string | null;
  plan?: BillingPlan | null;
  paidFeaturesEnabled?: boolean;
};

function isPaidFeatureLaunchEnabled(input: CanUseFeatureInput): boolean {
  return input.paidFeaturesEnabled ?? process.env.ENABLE_PAID_FEATURES === "true";
}

export function getUserBillingPlan(user?: EntitlementUser, explicitPlan?: BillingPlan | null): BillingPlan {
  if (explicitPlan) return explicitPlan;
  if (user?.role === "admin") return "admin";
  return "free";
}

export function canUseFeature(input: CanUseFeatureInput): FeatureEntitlementResult {
  const policy = FEATURE_POLICIES[input.feature];
  const plan = getUserBillingPlan(input.user, input.plan);
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
