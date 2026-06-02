import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import {
  countUsageEvents,
  recordUsageEvent,
} from "./db";
import type {
  BillingPlan,
  PaidFeatureKey,
} from "./featureEntitlements";
import {
  canUseFeature,
  getUserBillingPlan,
  loadPersistedFeatureAccess,
} from "./featureEntitlements";
import {
  buildUsageEvent,
  checkUsageCountLimit,
  getUsageKey,
  getUsagePeriodWindow,
  type UsagePeriod,
} from "./usageEvents";

type UsageLimitUser = Pick<User, "id" | "openId" | "email" | "name" | "role"> | null | undefined;

export type UsageLimitedFeatureKey =
  | "report-generation"
  | "saved-league"
  | "saved-report"
  | "source-trace-view"
  | "export"
  | "anomaly-alert";

type UsageLimitScope = "user" | "league";

export type UsageLimitPolicy = {
  featureKey: UsageLimitedFeatureKey;
  period: UsagePeriod;
  scope: UsageLimitScope;
  paidFeature?: PaidFeatureKey;
  limitsByPlan: Record<BillingPlan, number | null>;
};

export type PersistedUsageLimitResult = {
  allowed: boolean;
  featureKey: UsageLimitedFeatureKey;
  usageKey: string;
  period: UsagePeriod;
  scope: UsageLimitScope;
  plan: BillingPlan;
  effectivePlan: BillingPlan;
  limit: number | null;
  used: number;
  requested: number;
  remaining: number | null;
  windowStart: Date;
  windowEnd: Date;
  reason: string;
};

const PLAN_RANK: Record<BillingPlan, number> = {
  free: 0,
  pro: 1,
  elite: 2,
  admin: 3,
};

const USAGE_LIMIT_POLICIES: Record<UsageLimitedFeatureKey, UsageLimitPolicy> = {
  "report-generation": {
    featureKey: "report-generation",
    period: "day",
    scope: "user",
    limitsByPlan: {
      free: 1,
      pro: null,
      elite: null,
      admin: null,
    },
  },
  "saved-league": {
    featureKey: "saved-league",
    period: "season",
    scope: "user",
    limitsByPlan: {
      free: 1,
      pro: 10,
      elite: 50,
      admin: null,
    },
  },
  "saved-report": {
    featureKey: "saved-report",
    period: "month",
    scope: "user",
    limitsByPlan: {
      free: 1,
      pro: 25,
      elite: 100,
      admin: null,
    },
  },
  "source-trace-view": {
    featureKey: "source-trace-view",
    period: "day",
    scope: "league",
    paidFeature: "source-trace-details",
    limitsByPlan: {
      free: 0,
      pro: 25,
      elite: 100,
      admin: null,
    },
  },
  export: {
    featureKey: "export",
    period: "month",
    scope: "league",
    paidFeature: "exports",
    limitsByPlan: {
      free: 0,
      pro: 10,
      elite: 100,
      admin: null,
    },
  },
  "anomaly-alert": {
    featureKey: "anomaly-alert",
    period: "month",
    scope: "league",
    paidFeature: "anomaly-alerts",
    limitsByPlan: {
      free: 0,
      pro: 0,
      elite: 100,
      admin: null,
    },
  },
};

function maxBillingPlan(left: BillingPlan, right: BillingPlan): BillingPlan {
  return PLAN_RANK[left] >= PLAN_RANK[right] ? left : right;
}

function getSubjectIdentifiers(input: {
  user?: UsageLimitUser;
  leagueId?: string | null;
  scope: UsageLimitScope;
}): { userOpenId: string | null; leagueId: string | null } {
  const userOpenId = input.user?.openId?.trim() || null;
  const leagueId = input.leagueId?.trim() || null;

  if (input.scope === "league") {
    return { userOpenId: null, leagueId };
  }

  return { userOpenId, leagueId: null };
}

function getMissingSubjectReason(input: {
  identifiers: { userOpenId: string | null; leagueId: string | null };
  scope: UsageLimitScope;
}): string | null {
  if (input.scope === "user" && !input.identifiers.userOpenId) {
    return "Usage limit requires a signed-in user.";
  }
  if (input.scope === "league" && !input.identifiers.leagueId) {
    return "Usage limit requires a league ID.";
  }
  return null;
}

export function getUsageLimitPolicy(featureKey: UsageLimitedFeatureKey): UsageLimitPolicy {
  return USAGE_LIMIT_POLICIES[featureKey];
}

export function getPlanUsageLimit(input: {
  featureKey: UsageLimitedFeatureKey;
  plan: BillingPlan;
}): number | null {
  return getUsageLimitPolicy(input.featureKey).limitsByPlan[input.plan];
}

export async function checkPersistedUsageLimit(input: {
  user?: UsageLimitUser;
  featureKey: UsageLimitedFeatureKey;
  leagueId?: string | null;
  quantity?: number | null;
  paidFeaturesEnabled?: boolean;
  now?: Date;
}): Promise<PersistedUsageLimitResult> {
  const policy = getUsageLimitPolicy(input.featureKey);
  const now = input.now ?? new Date();
  const quantity = Math.max(1, Math.floor(Number(input.quantity || 1)));
  const identifiers = getSubjectIdentifiers({
    user: input.user,
    leagueId: input.leagueId,
    scope: policy.scope,
  });
  const usageKey = getUsageKey({
    featureKey: input.featureKey,
    period: policy.period,
    now,
  });
  const { windowStart, windowEnd } = getUsagePeriodWindow({
    period: policy.period,
    now,
  });
  let plan = getUserBillingPlan(input.user, null, [], now);
  let effectivePlan = plan;
  const missingSubjectReason = getMissingSubjectReason({
    identifiers,
    scope: policy.scope,
  });

  if (missingSubjectReason) {
    return {
      allowed: false,
      featureKey: input.featureKey,
      usageKey,
      period: policy.period,
      scope: policy.scope,
      plan,
      effectivePlan,
      limit: policy.limitsByPlan[plan],
      used: 0,
      requested: quantity,
      remaining: 0,
      windowStart,
      windowEnd,
      reason: missingSubjectReason,
    };
  }

  const persistedAccess = await loadPersistedFeatureAccess({
    user: input.user,
    leagueId: input.leagueId,
  });
  plan = getUserBillingPlan(input.user, null, persistedAccess.subscriptions, now);
  effectivePlan = plan;

  if (policy.paidFeature) {
    const entitlement = canUseFeature({
      user: input.user,
      feature: policy.paidFeature,
      leagueId: input.leagueId,
      paidFeaturesEnabled: input.paidFeaturesEnabled,
      ...persistedAccess,
    });

    if (!entitlement.allowed) {
      return {
        allowed: false,
        featureKey: input.featureKey,
        usageKey,
        period: policy.period,
        scope: policy.scope,
        plan,
        effectivePlan,
        limit: policy.limitsByPlan[plan],
        used: 0,
        requested: quantity,
        remaining: 0,
        windowStart,
        windowEnd,
        reason: entitlement.reason,
      };
    }

    effectivePlan = maxBillingPlan(plan, entitlement.requiredPlan);
  }

  const limit = policy.limitsByPlan[effectivePlan];
  if (limit === null) {
    return {
      allowed: true,
      featureKey: input.featureKey,
      usageKey,
      period: policy.period,
      scope: policy.scope,
      plan,
      effectivePlan,
      limit,
      used: 0,
      requested: quantity,
      remaining: null,
      windowStart,
      windowEnd,
      reason: "Allowed by unlimited usage policy.",
    };
  }

  const used = await countUsageEvents({
    ...identifiers,
    featureKey: input.featureKey,
    usageKey,
    createdAtFrom: windowStart,
    createdAtTo: windowEnd,
  });
  const usage = checkUsageCountLimit({
    used,
    limit,
    period: policy.period,
    requested: quantity,
    now,
  });

  return {
    allowed: usage.allowed,
    featureKey: input.featureKey,
    usageKey,
    period: policy.period,
    scope: policy.scope,
    plan,
    effectivePlan,
    limit,
    used: usage.used,
    requested: quantity,
    remaining: usage.remainingAfterRequest,
    windowStart: usage.windowStart,
    windowEnd: usage.windowEnd,
    reason: usage.allowed
      ? `Allowed with ${usage.remainingAfterRequest} use${usage.remainingAfterRequest === 1 ? "" : "s"} remaining.`
      : `Usage limit reached for ${input.featureKey}.`,
  };
}

export function assertUsageLimitResult(result: PersistedUsageLimitResult): PersistedUsageLimitResult {
  if (result.allowed) return result;

  throw new TRPCError({
    code: result.limit === 0 || result.reason.startsWith("Usage limit requires ")
      ? "FORBIDDEN"
      : "TOO_MANY_REQUESTS",
    message: result.reason,
  });
}

export async function assertPersistedUsageLimit(input: Parameters<typeof checkPersistedUsageLimit>[0]) {
  return assertUsageLimitResult(await checkPersistedUsageLimit(input));
}

export async function recordLimitedUsageEvent(input: {
  user?: UsageLimitUser;
  featureKey: UsageLimitedFeatureKey;
  leagueId?: string | null;
  quantity?: number | null;
  source: string;
  idempotencyKey: string;
  metadata?: unknown;
  now?: Date;
}): Promise<boolean> {
  const policy = getUsageLimitPolicy(input.featureKey);
  const identifiers = getSubjectIdentifiers({
    user: input.user,
    leagueId: input.leagueId,
    scope: policy.scope,
  });
  const missingSubjectReason = getMissingSubjectReason({
    identifiers,
    scope: policy.scope,
  });

  if (missingSubjectReason) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: missingSubjectReason,
    });
  }

  const ok = await recordUsageEvent(buildUsageEvent({
    ...identifiers,
    featureKey: input.featureKey,
    period: policy.period,
    quantity: input.quantity ?? 1,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
    now: input.now,
  }));

  if (!ok && process.env.NODE_ENV === "production") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Usage limits require database availability.",
    });
  }

  return ok;
}

export async function assertAndRecordLimitedUsage(input: Parameters<typeof recordLimitedUsageEvent>[0] & {
  paidFeaturesEnabled?: boolean;
}) {
  const limit = await assertPersistedUsageLimit({
    user: input.user,
    featureKey: input.featureKey,
    leagueId: input.leagueId,
    quantity: input.quantity,
    paidFeaturesEnabled: input.paidFeaturesEnabled,
    now: input.now,
  });
  const recorded = await recordLimitedUsageEvent(input);

  return {
    limit,
    recorded,
  };
}
