import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { listKtcSnapshotDateKeysSince } from "../db";
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
