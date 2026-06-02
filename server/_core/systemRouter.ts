import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, publicProcedure, router } from "./trpc";
import type { TrpcContext } from "./context";
import {
  getAdminBillingOverview,
  getLoginAttemptsSince,
  listAiPredictionEvents,
  listKtcSnapshotDateKeysSince,
  listSourceHealthEventsSince,
  updateAiPredictionOutcome,
  type StoredLoginAttempt,
  type StoredSourceHealthEvent,
} from "../db";
import { getSnapshotDateKey, listLocalKtcSnapshotDateKeysSince } from "../ktcLoader";
import { getApiProviderTelemetrySnapshot } from "../apiProviderTelemetry";
import { buildSourceCoverageMatrix } from "../sourceCoverageMatrix";
import { loadSourceSnapshotFreshnessDiagnostics } from "../sourceSnapshotFreshness";
import {
  buildAICalibrationAdjustmentProfile,
  buildAIModuleQualitySummary,
  buildAIOutcomeMemorySummary,
  summarizeAICounterfactualReliability,
  summarizeAIManagerTradeCalibration,
  summarizeAIPredictionReliability,
  summarizeSourceAgreementReliability,
} from "../aiPredictionCalibration";
import { resolvePendingAIPredictionOutcomes } from "../aiPredictionOutcomeJob";

const SNAPSHOT_TIME_ZONE = 'America/Vancouver';
const SYSTEM_ADMIN_RATE_LIMIT_BUCKET_MAX_ENTRIES = 1000;
const SYSTEM_ADMIN_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 10;
const systemAdminRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

type SystemAdminRateLimitContext = {
  req: TrpcContext["req"];
  user: NonNullable<TrpcContext["user"]>;
};

function getHeaderValue(headers: Record<string, any> | undefined, key: string): string | null {
  const value = headers?.[key];
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim())?.trim() || null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getSystemClientIp(req: { headers?: Record<string, any>; socket?: { remoteAddress?: string | null } }): string {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  const raw = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string" && forwardedFor.length > 0
      ? forwardedFor.split(",")[0]
      : getHeaderValue(req.headers, "x-vercel-forwarded-for")
        || getHeaderValue(req.headers, "cf-connecting-ip")
        || getHeaderValue(req.headers, "x-real-ip")
        || req.socket?.remoteAddress
        || "unknown";

  return String(raw).trim().replace(/^::ffff:/, "") || "unknown";
}

function pruneSystemAdminRateLimitBuckets(now: number, reserveKey: string) {
  for (const [key, bucket] of Array.from(systemAdminRateLimitBuckets.entries())) {
    if (bucket.resetAt <= now) systemAdminRateLimitBuckets.delete(key);
  }

  while (systemAdminRateLimitBuckets.size >= SYSTEM_ADMIN_RATE_LIMIT_BUCKET_MAX_ENTRIES) {
    const oldestKey = Array.from(systemAdminRateLimitBuckets.entries())
      .filter(([key]) => key !== reserveKey)
      .sort((a, b) => a[1].resetAt - b[1].resetAt)[0]?.[0];
    if (!oldestKey) break;
    systemAdminRateLimitBuckets.delete(oldestKey);
  }
}

function assertSystemAdminDiagnosticsRateLimit(ctx: SystemAdminRateLimitContext, id: string) {
  if (process.env.NODE_ENV === "test") return;

  const now = Date.now();
  const clientId = getSystemClientIp({
    headers: ctx.req.headers,
    socket: ctx.req.socket,
  });
  const scope = ctx.user.openId || String(ctx.user.id);
  const key = [id, "admin-user", scope].join(":");
  pruneSystemAdminRateLimitBuckets(now, key);
  const existing = systemAdminRateLimitBuckets.get(key);
  const bucket = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + SYSTEM_ADMIN_RATE_LIMIT_WINDOW_MS };

  bucket.count += 1;
  systemAdminRateLimitBuckets.set(key, bucket);

  if (bucket.count > 30) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    console.warn(`[SystemRateLimit] ${id} blocked for ${clientId}; retry after ${retryAfterSeconds}s`);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many admin diagnostic requests. Please wait a few minutes and try again.",
    });
  }
}

function shiftDateByDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getSnapshotStatusRange(lookbackDays: number) {
  const end = new Date();
  const start = shiftDateByDays(end, -(lookbackDays - 1));
  return { start, end };
}

function buildExpectedDateKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let cursor = new Date(start);

  while (getSnapshotDateKey(cursor) <= getSnapshotDateKey(end)) {
    keys.push(getSnapshotDateKey(cursor));
    cursor = shiftDateByDays(cursor, 1);
  }

  return keys;
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

function getUniqueCount(values: Set<string>): number {
  values.delete('');
  return values.size;
}

function createTrafficBucket(label: string) {
  return {
    label,
    count: 0,
    success: 0,
    error: 0,
    rateLimited: 0,
    uniqueUsernames: new Set<string>(),
    uniqueLeagueIds: new Set<string>(),
    firstSeen: null as Date | null,
    lastSeen: null as Date | null,
    lastUserAgent: null as string | null,
  };
}

function addAttemptToTrafficBucket(bucket: ReturnType<typeof createTrafficBucket>, attempt: StoredLoginAttempt) {
  bucket.count += 1;
  if (attempt.status === 'success') bucket.success += 1;
  if (attempt.status === 'error') bucket.error += 1;
  if (attempt.eventType === 'rate_limit') bucket.rateLimited += 1;
  if (attempt.username) bucket.uniqueUsernames.add(attempt.username);
  if (attempt.leagueId) bucket.uniqueLeagueIds.add(attempt.leagueId);
  if (!bucket.firstSeen || attempt.createdAt < bucket.firstSeen) bucket.firstSeen = attempt.createdAt;
  if (!bucket.lastSeen || attempt.createdAt > bucket.lastSeen) bucket.lastSeen = attempt.createdAt;
  if (attempt.userAgent) bucket.lastUserAgent = attempt.userAgent;
}

function serializeTrafficBucket(bucket: ReturnType<typeof createTrafficBucket>) {
  return {
    label: bucket.label,
    count: bucket.count,
    success: bucket.success,
    error: bucket.error,
    rateLimited: bucket.rateLimited,
    uniqueUsernames: getUniqueCount(bucket.uniqueUsernames),
    uniqueLeagueIds: getUniqueCount(bucket.uniqueLeagueIds),
    firstSeen: bucket.firstSeen ? toIsoString(bucket.firstSeen) : null,
    lastSeen: bucket.lastSeen ? toIsoString(bucket.lastSeen) : null,
    lastUserAgent: bucket.lastUserAgent,
  };
}

function createSourceHealthBucket(label: string) {
  return {
    label,
    count: 0,
    danger: 0,
    warn: 0,
    info: 0,
    firstSeen: null as Date | null,
    lastSeen: null as Date | null,
    lastMessage: null as string | null,
  };
}

function addSourceHealthEventToBucket(bucket: ReturnType<typeof createSourceHealthBucket>, event: StoredSourceHealthEvent) {
  bucket.count += 1;
  if (event.level === 'danger') bucket.danger += 1;
  if (event.level === 'warn') bucket.warn += 1;
  if (event.level === 'info') bucket.info += 1;
  if (!bucket.firstSeen || event.createdAt < bucket.firstSeen) {
    bucket.firstSeen = event.createdAt;
  }
  if (!bucket.lastSeen || event.createdAt > bucket.lastSeen) {
    bucket.lastSeen = event.createdAt;
    bucket.lastMessage = event.message;
  }
}

function serializeSourceHealthBucket(bucket: ReturnType<typeof createSourceHealthBucket>) {
  return {
    label: bucket.label,
    count: bucket.count,
    danger: bucket.danger,
    warn: bucket.warn,
    info: bucket.info,
    firstSeen: bucket.firstSeen ? toIsoString(bucket.firstSeen) : null,
    lastSeen: bucket.lastSeen ? toIsoString(bucket.lastSeen) : null,
    lastMessage: bucket.lastMessage,
  };
}

function buildTopBuckets(
  attempts: StoredLoginAttempt[],
  getLabel: (attempt: StoredLoginAttempt) => string | null | undefined,
  limit: number
) {
  const buckets = new Map<string, ReturnType<typeof createTrafficBucket>>();
  for (const attempt of attempts) {
    const label = getLabel(attempt)?.trim() || 'unknown';
    const bucket = buckets.get(label) || createTrafficBucket(label);
    addAttemptToTrafficBucket(bucket, attempt);
    buckets.set(label, bucket);
  }

  return Array.from(buckets.values())
    .map(serializeTrafficBucket)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function buildSourceHealthBuckets(
  events: StoredSourceHealthEvent[],
  getLabel: (event: StoredSourceHealthEvent) => string | null | undefined,
  limit: number
) {
  const buckets = new Map<string, ReturnType<typeof createSourceHealthBucket>>();
  for (const event of events) {
    const label = getLabel(event)?.trim() || 'unknown';
    const bucket = buckets.get(label) || createSourceHealthBucket(label);
    addSourceHealthEventToBucket(bucket, event);
    buckets.set(label, bucket);
  }

  return Array.from(buckets.values())
    .map(serializeSourceHealthBucket)
    .sort((a, b) => b.danger - a.danger || b.warn - a.warn || b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  snapshotCoverage: adminProcedure
    .input(
      z.object({
        lookbackDays: z.number().int().min(1).max(90).default(14),
      })
    )
    .query(async ({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.snapshotCoverage");
      const { start, end } = getSnapshotStatusRange(input.lookbackDays);
      const expectedDateKeys = buildExpectedDateKeys(start, end);
      const storedDateKeys = Array.from(new Set([
        ...(await listKtcSnapshotDateKeysSince(start)),
        ...listLocalKtcSnapshotDateKeysSince(start),
      ])).sort();
      const storedSet = new Set(storedDateKeys);
      const missingDateKeys = expectedDateKeys.filter((dateKey) => !storedSet.has(dateKey));
      const latestSnapshotDateKey = storedDateKeys.at(-1) || null;
      const todayDateKey = getSnapshotDateKey(end);
      const yesterdayDateKey = expectedDateKeys.at(-2) || null;
      const hasToday = storedSet.has(todayDateKey);
      const hasYesterday = yesterdayDateKey ? storedSet.has(yesterdayDateKey) : false;
      const onlyTodayMissing = missingDateKeys.length === 1 && missingDateKeys[0] === todayDateKey;
      const status = missingDateKeys.length === 0
        ? 'healthy'
        : onlyTodayMissing && hasYesterday
          ? 'today_pending'
          : 'stale';

      return {
        ok: missingDateKeys.length === 0,
        timeZone: SNAPSHOT_TIME_ZONE,
        lookbackDays: input.lookbackDays,
        latestSnapshotDateKey,
        todayDateKey,
        missingDateKeys,
        expectedDays: expectedDateKeys.length,
        storedDays: storedDateKeys.length,
        status,
      } as const;
    }),

  abuseTelemetry: adminProcedure
    .input(
      z.object({
        lookbackDays: z.number().int().min(1).max(30).default(7),
      })
    )
    .query(async ({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.abuseTelemetry");
      const since = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);
      const attempts = await getLoginAttemptsSince(since);
      const successfulAnalyzeEvents = attempts.filter((attempt) => attempt.eventType === 'analyze_league' && attempt.status === 'success');
      const cachedReports = successfulAnalyzeEvents.filter((attempt) =>
        typeof attempt.note === 'string' && attempt.note.startsWith('Served cached league report')
      ).length;
      const generatedReports = successfulAnalyzeEvents.length - cachedReports;

      return {
        generatedAt: new Date().toISOString(),
        lookbackDays: input.lookbackDays,
        totals: {
          events: attempts.length,
          successes: attempts.filter((attempt) => attempt.status === 'success').length,
          errors: attempts.filter((attempt) => attempt.status === 'error').length,
          findLeagueEvents: attempts.filter((attempt) => attempt.eventType === 'find_leagues').length,
          analyzeEvents: attempts.filter((attempt) => attempt.eventType === 'analyze_league').length,
          rateLimitEvents: attempts.filter((attempt) => attempt.eventType === 'rate_limit').length,
          cachedReports,
          generatedReports,
          uniqueIps: new Set(attempts.map((attempt) => attempt.ipAddress || '').filter(Boolean)).size,
          uniqueLeagueIds: new Set(attempts.map((attempt) => attempt.leagueId || '').filter(Boolean)).size,
          uniqueUsernames: new Set(attempts.map((attempt) => attempt.username || '').filter(Boolean)).size,
        },
        topIps: buildTopBuckets(attempts, (attempt) => attempt.ipAddress, 10),
        topLeagueIds: buildTopBuckets(
          attempts.filter((attempt) => Boolean(attempt.leagueId)),
          (attempt) => attempt.leagueId,
          10
        ),
        topUsernames: buildTopBuckets(
          attempts.filter((attempt) => Boolean(attempt.username)),
          (attempt) => attempt.username,
          10
        ),
        topUserAgents: buildTopBuckets(attempts, (attempt) => attempt.userAgent, 8),
        recentEvents: attempts.slice(0, 25).map((attempt) => ({
          id: attempt.id,
          createdAt: toIsoString(attempt.createdAt),
          eventType: attempt.eventType,
          status: attempt.status,
          username: attempt.username,
          leagueId: attempt.leagueId,
          ipAddress: attempt.ipAddress,
          note: attempt.note,
          userAgent: attempt.userAgent,
        })),
      } as const;
    }),

  sourceHealth: adminProcedure
    .input(
      z.object({
        lookbackDays: z.number().int().min(1).max(30).default(7),
      })
    )
    .query(async ({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.sourceHealth");
      const since = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);
      const events = await listSourceHealthEventsSince(since, 100);
      const dangerEvents = events.filter((event) => event.level === 'danger');
      const warnEvents = events.filter((event) => event.level === 'warn');

      return {
        generatedAt: new Date().toISOString(),
        lookbackDays: input.lookbackDays,
        totals: {
          events: events.length,
          danger: dangerEvents.length,
          warn: warnEvents.length,
          info: events.filter((event) => event.level === 'info').length,
          uniqueSources: new Set(events.map((event) => event.sourceKey)).size,
        },
        bySource: buildSourceHealthBuckets(events, (event) => event.source, 10),
        byJob: buildSourceHealthBuckets(events, (event) => event.job, 8),
        recentEvents: events.slice(0, 25).map((event) => ({
          id: event.id,
          createdAt: toIsoString(event.createdAt),
          job: event.job,
          board: event.board,
          sourceKey: event.sourceKey,
          source: event.source,
          level: event.level,
          status: event.status,
          rowCount: event.rowCount ?? null,
          message: event.message,
        })),
      } as const;
    }),

  billingOverview: adminProcedure
    .input(
      z.object({
        lookbackDays: z.number().int().min(1).max(365).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.billingOverview");
      const usageSince = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);
      const overview = await getAdminBillingOverview({
        usageSince,
        limit: 12,
      });

      return {
        generatedAt: new Date().toISOString(),
        lookbackDays: input.lookbackDays,
        usageSince: usageSince.toISOString(),
        ...overview,
      } as const;
    }),

  sourceCoverageMatrix: adminProcedure
    .input(
      z.object({
        lookbackDays: z.number().int().min(1).max(30).default(14),
        currentSeason: z.string().regex(/^\d{4}$/).default(String(new Date().getFullYear())),
        valueProfileKey: z.string().min(1).max(80).default('12_sf_ppr_base'),
        devyProfileKey: z.string().min(1).max(80).optional().nullable(),
      })
    )
    .query(async ({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.sourceCoverageMatrix");
      const previousSeason = String(Number(input.currentSeason) - 1);
      const since = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);
      const [freshnessDiagnostics, healthEvents] = await Promise.all([
        loadSourceSnapshotFreshnessDiagnostics({
          currentSeason: input.currentSeason,
          previousSeason,
          valueProfileKey: input.valueProfileKey,
          devyProfileKey: input.devyProfileKey,
        }),
        listSourceHealthEventsSince(since, 300),
      ]);

      return buildSourceCoverageMatrix({
        currentSeason: input.currentSeason,
        previousSeason,
        valueProfileKey: input.valueProfileKey,
        devyProfileKey: input.devyProfileKey,
        lookbackDays: input.lookbackDays,
        freshnessDiagnostics,
        healthEvents,
      });
    }),

  apiProviderTelemetry: adminProcedure
    .input(
      z.object({
        lookbackDays: z.number().int().min(1).max(30).default(7),
        limit: z.number().int().min(1).max(25).default(10),
      })
    )
    .query(({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.apiProviderTelemetry");
      return getApiProviderTelemetrySnapshot({
        lookbackMs: input.lookbackDays * 24 * 60 * 60 * 1000,
        limit: input.limit,
      });
    }),

  aiCalibration: adminProcedure
    .input(
      z.object({
        leagueId: z.string().max(64).optional().nullable(),
        limit: z.number().int().min(25).max(1000).default(500),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.aiCalibration");
      const events = await listAiPredictionEvents({
        leagueId: input?.leagueId || null,
        limit: input?.limit || 500,
      });
      const reliability = summarizeAIPredictionReliability(events);
      const sourceAgreement = summarizeSourceAgreementReliability(events);
      const counterfactuals = summarizeAICounterfactualReliability(events);
      const managerTrades = summarizeAIManagerTradeCalibration(events);
      const adjustmentProfile = buildAICalibrationAdjustmentProfile(events);
      const moduleQuality = buildAIModuleQualitySummary(events);
      const outcomeMemory = buildAIOutcomeMemorySummary(events);

      return {
        generatedAt: new Date().toISOString(),
        eventCount: events.length,
        leagueId: input?.leagueId || null,
        reliability,
        sourceAgreement,
        counterfactuals,
        managerTrades,
        adjustmentProfile,
        moduleQuality,
        outcomeMemory,
        recentEvents: events.slice(0, 50).map(event => ({
          eventId: event.eventId,
          predictionKey: event.predictionKey,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt || null,
          leagueId: event.leagueId || null,
          surface: event.surface,
          action: event.action,
          decision: event.decision,
          entityType: event.entityType,
          entityId: event.entityId || null,
          entityName: event.entityName || null,
          label: event.label,
          finalScore: event.finalScore,
          sourceAgreement: event.sourceAgreement?.state || 'unknown',
          counterfactualStatus: event.counterfactual?.status || 'missing-baseline',
          counterfactualEdge: event.counterfactual?.edge ?? null,
          baselineLabel: event.counterfactual?.baseline.label || null,
          baselineScore: event.counterfactual?.baseline.score ?? event.outcome.baselineValue ?? null,
          expiresAt: event.expiresAt || event.decay?.expiresAt || null,
          realizedEdgeStatus: event.outcome.realizedEdge?.status || null,
          realizedEdge: event.outcome.realizedEdge?.realizedEdge ?? null,
          feedbackSource: event.outcome.feedbackSource || null,
          outcomeStatus: event.outcome.status,
        })),
      } as const;
    }),

  markAiPredictionOutcome: adminProcedure
    .input(
      z.object({
        eventId: z.string().min(1).max(128),
        status: z.enum(["hit", "miss", "push", "blocked"]),
        note: z.string().max(1000).optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.markAiPredictionOutcome");
      const statusNote = input.note || (
        input.status === "hit"
          ? "Manual feedback marked this AI read as worked."
          : input.status === "miss"
            ? "Manual feedback marked this AI read as a bad read."
            : input.status === "push"
              ? "Manual feedback marked this AI read as ignored or not scorable."
              : "Manual feedback marked this AI read as blocked."
      );
      const persisted = await updateAiPredictionOutcome({
        eventId: input.eventId,
        outcome: {
          status: input.status,
          resolvedAt: new Date().toISOString(),
          actualValue: input.status === "hit" ? 1 : input.status === "miss" ? 0 : null,
          baselineValue: input.status === "hit" || input.status === "miss" ? 0.5 : null,
          feedbackSource: "admin",
          realizedEdge: {
            status: "manual",
            predictedEdge: null,
            actualValue: input.status === "hit" ? 1 : input.status === "miss" ? 0 : null,
            baselineValue: input.status === "hit" || input.status === "miss" ? 0.5 : null,
            realizedEdge: input.status === "hit" ? 0.5 : input.status === "miss" ? -0.5 : null,
            baselineKind: "unknown",
            source: "admin-feedback",
            note: statusNote,
          },
          note: statusNote,
        },
      });

      return { persisted };
    }),

  resolveAiPredictionOutcomes: adminProcedure
    .input(
      z.object({
        leagueId: z.string().max(64).optional().nullable(),
        limit: z.number().int().min(1).max(1000).default(200),
      }).optional()
    )
    .mutation(({ input, ctx }) => {
      assertSystemAdminDiagnosticsRateLimit(ctx, "system.resolveAiPredictionOutcomes");
      return resolvePendingAIPredictionOutcomes({
        leagueId: input?.leagueId || null,
        limit: input?.limit || 200,
      });
    }),
});
