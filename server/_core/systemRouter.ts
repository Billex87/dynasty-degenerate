import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getLoginAttemptsSince, listKtcSnapshotDateKeysSince, type StoredLoginAttempt } from "../db";
import { getSnapshotDateKey, listLocalKtcSnapshotDateKeysSince } from "../ktcLoader";

const SNAPSHOT_TIME_ZONE = 'America/Vancouver';

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

  snapshotCoverage: publicProcedure
    .input(
      z.object({
        lookbackDays: z.number().int().min(1).max(90).default(14),
      })
    )
    .query(async ({ input }) => {
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
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);
      const attempts = await getLoginAttemptsSince(since);
      const successfulAnalyzeEvents = attempts.filter((attempt) => attempt.eventType === 'analyze_league' && attempt.status === 'success');
      const cachedReports = successfulAnalyzeEvents.filter((attempt) => attempt.note === 'Served cached league report').length;
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

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
