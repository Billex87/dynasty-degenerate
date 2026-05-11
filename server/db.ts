import { neon } from "@neondatabase/serverless";
import type { InsertUser, User } from "../drizzle/schema";
import type { ActionPlanRecord, WaiverBidHistoryRecord } from "../shared/types";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;
let schemaReady: Promise<void> | null = null;
const shouldQuietDevLogs = () =>
  process.env.QUIET_DEV_LOGS === "true" ||
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true";
const warnWhenDatabaseUnavailable = (...args: Parameters<typeof console.warn>) => {
  if (!shouldQuietDevLogs()) console.warn(...args);
};

export type LoginAttemptEvent = {
  eventType: "find_leagues" | "analyze_league" | "rate_limit";
  status: "success" | "error";
  username?: string | null;
  leagueId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  note?: string | null;
};

export type StoredLoginAttempt = LoginAttemptEvent & {
  id: number;
  createdAt: Date;
};

export type MonthlyReportGenerationReservation = {
  allowed: boolean;
  userKey: string;
  snapshotMonth: string;
  existing?: {
    leagueId: string | null;
    createdAt: Date;
  } | null;
};

export type SourceHealthEventInput = {
  job: string;
  board?: string | null;
  sourceKey: string;
  source: string;
  level: "info" | "warn" | "danger";
  status: string;
  rowCount?: number | null;
  message: string;
  payload?: unknown;
  createdAt?: Date | string | null;
};

export type StoredSourceHealthEvent = SourceHealthEventInput & {
  id: number;
  createdAt: Date;
};

function getSql() {
  if (!process.env.DATABASE_URL) return null;
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

async function ensureSchema(sql: SqlClient) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          "openId" VARCHAR(64) NOT NULL UNIQUE,
          name TEXT,
          email VARCHAR(320),
          "loginMethod" VARCHAR(64),
          role VARCHAR(16) NOT NULL DEFAULT 'user',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "lastSignedIn" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "ktcSnapshots" (
          id SERIAL PRIMARY KEY,
          "snapshotDate" TIMESTAMPTZ NOT NULL,
          "ktcData" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "ktcSnapshots_snapshotDate_idx"
        ON "ktcSnapshots" ("snapshotDate" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "prospectSnapshots" (
          id SERIAL PRIMARY KEY,
          source VARCHAR(64) NOT NULL,
          "snapshotMonth" VARCHAR(7) NOT NULL,
          "prospectData" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "prospectSnapshots_source_month_uidx"
        ON "prospectSnapshots" (source, "snapshotMonth")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "prospectSnapshots_source_month_idx"
        ON "prospectSnapshots" (source, "snapshotMonth" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "redraftSourceSnapshots" (
          id SERIAL PRIMARY KEY,
          "snapshotKey" VARCHAR(10) NOT NULL,
          season VARCHAR(4) NOT NULL,
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "redraftSourceSnapshots_season_key_uidx"
        ON "redraftSourceSnapshots" (season, "snapshotKey")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "redraftSourceSnapshots_season_key_idx"
        ON "redraftSourceSnapshots" (season, "snapshotKey" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "devySourceSnapshots" (
          id SERIAL PRIMARY KEY,
          "snapshotKey" VARCHAR(10) NOT NULL,
          "profileKey" VARCHAR(64) NOT NULL,
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "devySourceSnapshots_profile_key_uidx"
        ON "devySourceSnapshots" ("profileKey", "snapshotKey")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "devySourceSnapshots_profile_key_idx"
        ON "devySourceSnapshots" ("profileKey", "snapshotKey" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "leagueAiConfidenceSnapshots" (
          id SERIAL PRIMARY KEY,
          "snapshotKey" VARCHAR(10) NOT NULL,
          "leagueId" TEXT NOT NULL,
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "leagueAiConfidenceSnapshots_league_key_uidx"
        ON "leagueAiConfidenceSnapshots" ("leagueId", "snapshotKey")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "leagueAiConfidenceSnapshots_league_key_idx"
        ON "leagueAiConfidenceSnapshots" ("leagueId", "snapshotKey" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "loginAttempts" (
          id SERIAL PRIMARY KEY,
          "eventType" VARCHAR(32) NOT NULL,
          status VARCHAR(16) NOT NULL,
          username TEXT,
          "leagueId" TEXT,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          note TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "loginAttempts_createdAt_idx"
        ON "loginAttempts" ("createdAt" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "leagueReportCache" (
          id SERIAL PRIMARY KEY,
          "cacheKey" TEXT NOT NULL UNIQUE,
          "leagueId" TEXT NOT NULL,
          "viewerUserId" TEXT,
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "leagueReportCache_leagueId_updatedAt_idx"
        ON "leagueReportCache" ("leagueId", "updatedAt" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "sourceHealthEvents" (
          id SERIAL PRIMARY KEY,
          job TEXT NOT NULL,
          board VARCHAR(16),
          "sourceKey" TEXT NOT NULL,
          source TEXT NOT NULL,
          level VARCHAR(16) NOT NULL,
          status VARCHAR(16) NOT NULL,
          "rowCount" INTEGER,
          message TEXT NOT NULL,
          payload TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "sourceHealthEvents_createdAt_idx"
        ON "sourceHealthEvents" ("createdAt" DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "sourceHealthEvents_source_createdAt_idx"
        ON "sourceHealthEvents" ("sourceKey", "createdAt" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "monthlyRosterBlueprintSnapshots" (
          id SERIAL PRIMARY KEY,
          "leagueId" TEXT NOT NULL,
          manager TEXT NOT NULL,
          "snapshotMonth" VARCHAR(7) NOT NULL,
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "monthlyRosterBlueprintSnapshots_league_manager_month_uidx"
        ON "monthlyRosterBlueprintSnapshots" ("leagueId", manager, "snapshotMonth")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "monthlyRosterBlueprintSnapshots_league_month_idx"
        ON "monthlyRosterBlueprintSnapshots" ("leagueId", "snapshotMonth" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "monthlyReportGenerations" (
          id SERIAL PRIMARY KEY,
          "userKey" TEXT NOT NULL,
          "userLabel" TEXT,
          "snapshotMonth" VARCHAR(7) NOT NULL,
          "leagueId" TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "monthlyReportGenerations_user_month_uidx"
        ON "monthlyReportGenerations" ("userKey", "snapshotMonth")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "monthlyReportGenerations_month_createdAt_idx"
        ON "monthlyReportGenerations" ("snapshotMonth", "createdAt" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "actionPlans" (
          id SERIAL PRIMARY KEY,
          "userKey" TEXT NOT NULL,
          "planId" TEXT NOT NULL,
          kind VARCHAR(16) NOT NULL,
          "leagueId" TEXT,
          manager TEXT,
          "playerId" TEXT,
          "replacementPlayerId" TEXT,
          title TEXT NOT NULL,
          summary TEXT,
          status VARCHAR(16) NOT NULL,
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "actionPlans_user_plan_uidx"
        ON "actionPlans" ("userKey", "planId")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "actionPlans_user_league_updatedAt_idx"
        ON "actionPlans" ("userKey", "leagueId", "updatedAt" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "waiverBidHistory" (
          id SERIAL PRIMARY KEY,
          "userKey" TEXT NOT NULL,
          "historyId" TEXT NOT NULL,
          "leagueId" TEXT,
          manager TEXT,
          "playerId" TEXT NOT NULL,
          "playerName" TEXT NOT NULL,
          position VARCHAR(8) NOT NULL,
          "bidMin" INTEGER NOT NULL,
          "bidMax" INTEGER NOT NULL,
          "bidLabel" TEXT NOT NULL,
          source VARCHAR(32) NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "waiverBidHistory_user_history_uidx"
        ON "waiverBidHistory" ("userKey", "historyId")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "waiverBidHistory_user_league_updatedAt_idx"
        ON "waiverBidHistory" ("userKey", "leagueId", "updatedAt" DESC)
      `;
    })();
  }

  return schemaReady;
}

export async function getDb() {
  const sql = getSql();
  if (!sql) return null;

  try {
    await ensureSchema(sql);
    return sql;
  } catch (error) {
    console.warn("[Database] Failed to initialize:", error);
    return null;
  }
}

function normalizeUser(row: any): User {
  return {
    id: Number(row.id),
    openId: row.openId,
    name: row.name ?? null,
    email: row.email ?? null,
    loginMethod: row.loginMethod ?? null,
    role: row.role === "admin" ? "admin" : "user",
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    lastSignedIn: new Date(row.lastSignedIn),
  };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert user: database not available");
    return;
  }

  const role = user.role ?? "user";
  const lastSignedIn = user.lastSignedIn ?? new Date();

  await sql`
    INSERT INTO users (
      "openId",
      name,
      email,
      "loginMethod",
      role,
      "lastSignedIn",
      "updatedAt"
    )
    VALUES (
      ${user.openId},
      ${user.name ?? null},
      ${user.email ?? null},
      ${user.loginMethod ?? null},
      ${role},
      ${lastSignedIn},
      NOW()
    )
    ON CONFLICT ("openId") DO UPDATE SET
      name = COALESCE(EXCLUDED.name, users.name),
      email = COALESCE(EXCLUDED.email, users.email),
      "loginMethod" = COALESCE(EXCLUDED."loginMethod", users."loginMethod"),
      role = EXCLUDED.role,
      "lastSignedIn" = EXCLUDED."lastSignedIn",
      "updatedAt" = NOW()
  `;
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await sql`
    SELECT
      id,
      "openId",
      name,
      email,
      "loginMethod",
      role,
      "createdAt",
      "updatedAt",
      "lastSignedIn"
    FROM users
    WHERE "openId" = ${openId}
    LIMIT 1
  ` as Record<string, any>[];

  return result.length > 0 ? normalizeUser(result[0]) : undefined;
}

export async function insertKtcSnapshot(snapshotDate: Date, ktcData: string) {
  const sql = await getDb();
  if (!sql) return false;

  await sql`
    INSERT INTO "ktcSnapshots" ("snapshotDate", "ktcData")
    VALUES (${snapshotDate}, ${ktcData})
  `;

  return true;
}

export async function findKtcSnapshotOnOrBefore(targetDate: Date) {
  const sql = await getDb();
  if (!sql) return null;

  const result = await sql`
    SELECT "ktcData"
    FROM "ktcSnapshots"
    WHERE "snapshotDate" <= ${targetDate}
    ORDER BY "snapshotDate" DESC
    LIMIT 1
  ` as Record<string, any>[];

  return result[0]?.ktcData ?? null;
}

export async function findKtcSnapshotBetween(startDate: Date, targetDate: Date) {
  const sql = await getDb();
  if (!sql) return null;

  const result = await sql`
    SELECT "ktcData"
    FROM "ktcSnapshots"
    WHERE "snapshotDate" >= ${startDate}
      AND "snapshotDate" <= ${targetDate}
    ORDER BY "snapshotDate" DESC
    LIMIT 1
  ` as Record<string, any>[];

  return result[0]?.ktcData ?? null;
}

export async function listKtcSnapshotDateKeysSince(targetDate: Date): Promise<string[]> {
  const sql = await getDb();
  if (!sql) return [];

  const result = await sql`
    SELECT DISTINCT to_char("snapshotDate" AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD') AS day
    FROM "ktcSnapshots"
    WHERE "snapshotDate" >= ${targetDate}
    ORDER BY day ASC
  ` as Array<{ day?: string | null }>;

  return result
    .map((row) => row.day || null)
    .filter((day): day is string => Boolean(day));
}

export async function upsertProspectSnapshot(source: string, snapshotMonth: string, prospectData: string) {
  const sql = await getDb();
  if (!sql) return false;

  await sql`
    INSERT INTO "prospectSnapshots" (source, "snapshotMonth", "prospectData")
    VALUES (${source}, ${snapshotMonth}, ${prospectData})
    ON CONFLICT (source, "snapshotMonth") DO UPDATE SET
      "prospectData" = EXCLUDED."prospectData",
      "createdAt" = NOW()
  `;

  return true;
}

export async function findLatestProspectSnapshot(source: string) {
  const sql = await getDb();
  if (!sql) return null;

  const result = await sql`
    SELECT "prospectData"
    FROM "prospectSnapshots"
    WHERE source = ${source}
    ORDER BY "snapshotMonth" DESC
    LIMIT 1
  ` as Record<string, any>[];

  return result[0]?.prospectData ?? null;
}

export async function upsertRedraftSourceSnapshot(input: {
  snapshotKey: string;
  season: string;
  payload: string;
}) {
  const sql = await getDb();
  if (!sql) return false;

  await sql`
    INSERT INTO "redraftSourceSnapshots" ("snapshotKey", season, payload)
    VALUES (${input.snapshotKey}, ${input.season}, ${input.payload})
    ON CONFLICT (season, "snapshotKey") DO UPDATE SET
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()
  `;

  return true;
}

export async function findLatestRedraftSourceSnapshot(season: string) {
  const sql = await getDb();
  if (!sql) return null;

  const result = await sql`
    SELECT payload
    FROM "redraftSourceSnapshots"
    WHERE season = ${season}
    ORDER BY "snapshotKey" DESC
    LIMIT 1
  ` as Record<string, any>[];

  return result[0]?.payload ?? null;
}

export async function listRedraftSourceSnapshots(season: string, limit = 14) {
  const sql = await getDb();
  if (!sql) return [];

  const boundedLimit = Math.max(1, Math.min(60, Math.floor(limit)));
  const result = await sql`
    SELECT "snapshotKey", payload, "updatedAt"
    FROM "redraftSourceSnapshots"
    WHERE season = ${season}
    ORDER BY "snapshotKey" DESC
    LIMIT ${boundedLimit}
  ` as Array<{ snapshotKey?: string | null; payload?: string | null; updatedAt?: Date | string | null }>;

  return result
    .filter((row) => row.snapshotKey && row.payload)
    .map((row) => ({
      snapshotKey: String(row.snapshotKey),
      payload: String(row.payload),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    }));
}

export async function upsertDevySourceSnapshot(input: {
  snapshotKey: string;
  profileKey: string;
  payload: string;
}) {
  const sql = await getDb();
  if (!sql) return false;

  await sql`
    INSERT INTO "devySourceSnapshots" ("snapshotKey", "profileKey", payload)
    VALUES (${input.snapshotKey}, ${input.profileKey}, ${input.payload})
    ON CONFLICT ("profileKey", "snapshotKey") DO UPDATE SET
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listDevySourceSnapshots(profileKey: string, limit = 14) {
  const sql = await getDb();
  if (!sql) return [];

  const boundedLimit = Math.max(1, Math.min(60, Math.floor(limit)));
  const result = await sql`
    SELECT "snapshotKey", payload, "updatedAt"
    FROM "devySourceSnapshots"
    WHERE "profileKey" = ${profileKey}
    ORDER BY "snapshotKey" DESC
    LIMIT ${boundedLimit}
  ` as Array<{ snapshotKey?: string | null; payload?: string | null; updatedAt?: Date | string | null }>;

  return result
    .filter((row) => row.snapshotKey && row.payload)
    .map((row) => ({
      snapshotKey: String(row.snapshotKey),
      payload: String(row.payload),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    }));
}

export async function upsertLeagueAiConfidenceSnapshot(input: {
  snapshotKey: string;
  leagueId: string;
  payload: string;
}) {
  const sql = await getDb();
  if (!sql) return false;

  await sql`
    INSERT INTO "leagueAiConfidenceSnapshots" ("snapshotKey", "leagueId", payload)
    VALUES (${input.snapshotKey}, ${input.leagueId}, ${input.payload})
    ON CONFLICT ("leagueId", "snapshotKey") DO UPDATE SET
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listLeagueAiConfidenceSnapshots(leagueId: string, limit = 14) {
  const sql = await getDb();
  if (!sql) return [];

  const boundedLimit = Math.max(1, Math.min(60, Math.floor(limit)));
  const result = await sql`
    SELECT "snapshotKey", payload, "updatedAt"
    FROM "leagueAiConfidenceSnapshots"
    WHERE "leagueId" = ${leagueId}
    ORDER BY "snapshotKey" DESC
    LIMIT ${boundedLimit}
  ` as Array<{ snapshotKey?: string | null; payload?: string | null; updatedAt?: Date | string | null }>;

  return result
    .filter((row) => row.snapshotKey && row.payload)
    .map((row) => ({
      snapshotKey: String(row.snapshotKey),
      payload: String(row.payload),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    }));
}

export async function insertSourceHealthEvents(events: SourceHealthEventInput[]): Promise<boolean> {
  const sql = await getDb();
  if (!sql || events.length === 0) return false;

  for (const event of events) {
    await sql`
      INSERT INTO "sourceHealthEvents" (
        job,
        board,
        "sourceKey",
        source,
        level,
        status,
        "rowCount",
        message,
        payload,
        "createdAt"
      )
      VALUES (
        ${event.job},
        ${event.board ?? null},
        ${event.sourceKey},
        ${event.source},
        ${event.level},
        ${event.status},
        ${event.rowCount ?? null},
        ${event.message},
        ${event.payload === undefined ? null : JSON.stringify(event.payload)},
        ${event.createdAt ? new Date(event.createdAt) : new Date()}
      )
    `;
  }

  return true;
}

export async function listSourceHealthEventsSince(since: Date, limit = 100): Promise<StoredSourceHealthEvent[]> {
  const sql = await getDb();
  if (!sql) return [];

  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const result = await sql`
    SELECT id, job, board, "sourceKey", source, level, status, "rowCount", message, payload, "createdAt"
    FROM "sourceHealthEvents"
    WHERE "createdAt" >= ${since}
    ORDER BY "createdAt" DESC
    LIMIT ${boundedLimit}
  ` as Array<{
    id?: number | string | null;
    job?: string | null;
    board?: string | null;
    sourceKey?: string | null;
    source?: string | null;
    level?: string | null;
    status?: string | null;
    rowCount?: number | string | null;
    message?: string | null;
    payload?: string | null;
    createdAt?: Date | string | null;
  }>;

  return result.map((row) => {
    let payload: unknown = undefined;
    if (row.payload) {
      try {
        payload = JSON.parse(row.payload);
      } catch {
        payload = { raw: row.payload };
      }
    }

    return {
      id: Number(row.id),
      job: String(row.job || 'unknown'),
      board: row.board || null,
      sourceKey: String(row.sourceKey || 'unknown'),
      source: String(row.source || row.sourceKey || 'Unknown source'),
      level: row.level === 'danger' ? 'danger' : row.level === 'warn' ? 'warn' : 'info',
      status: String(row.status || 'unknown'),
      rowCount: row.rowCount === null || row.rowCount === undefined ? null : Number(row.rowCount),
      message: String(row.message || ''),
      payload,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    };
  });
}

function normalizeLoginAttempt(row: any): StoredLoginAttempt {
  const eventType = row.eventType === "analyze_league"
    ? "analyze_league"
    : row.eventType === "rate_limit"
      ? "rate_limit"
      : "find_leagues";

  return {
    id: Number(row.id),
    eventType,
    status: row.status === "error" ? "error" : "success",
    username: row.username ?? null,
    leagueId: row.leagueId ?? null,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    note: row.note ?? null,
    createdAt: new Date(row.createdAt),
  };
}

export async function insertLoginAttempt(event: LoginAttemptEvent): Promise<void> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot insert login attempt: database not available");
    return;
  }

  await sql`
    INSERT INTO "loginAttempts" (
      "eventType",
      status,
      username,
      "leagueId",
      "ipAddress",
      "userAgent",
      note
    )
    VALUES (
      ${event.eventType},
      ${event.status},
      ${event.username ?? null},
      ${event.leagueId ?? null},
      ${event.ipAddress ?? null},
      ${event.userAgent ?? null},
      ${event.note ?? null}
    )
  `;
}

export async function getLoginAttemptsSince(targetDate: Date): Promise<StoredLoginAttempt[]> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot read login attempts: database not available");
    return [];
  }

  const result = await sql`
    SELECT
      id,
      "eventType",
      status,
      username,
      "leagueId",
      "ipAddress",
      "userAgent",
      note,
      "createdAt"
    FROM "loginAttempts"
    WHERE "createdAt" >= ${targetDate}
    ORDER BY "createdAt" DESC
  ` as Record<string, any>[];

  return result.map(normalizeLoginAttempt);
}

export async function reserveMonthlyReportGeneration(input: {
  userKey: string;
  userLabel?: string | null;
  snapshotMonth: string;
  leagueId?: string | null;
}): Promise<MonthlyReportGenerationReservation | null> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot reserve monthly report generation: database not available");
    return null;
  }

  const inserted = await sql`
    INSERT INTO "monthlyReportGenerations" (
      "userKey",
      "userLabel",
      "snapshotMonth",
      "leagueId"
    )
    VALUES (
      ${input.userKey},
      ${input.userLabel ?? null},
      ${input.snapshotMonth},
      ${input.leagueId ?? null}
    )
    ON CONFLICT ("userKey", "snapshotMonth") DO NOTHING
    RETURNING "leagueId", "createdAt"
  ` as Array<{ leagueId?: string | null; createdAt: Date | string }>;

  if (inserted[0]) {
    return {
      allowed: true,
      userKey: input.userKey,
      snapshotMonth: input.snapshotMonth,
      existing: {
        leagueId: inserted[0].leagueId ?? null,
        createdAt: new Date(inserted[0].createdAt),
      },
    };
  }

  const existing = await sql`
    SELECT "leagueId", "createdAt"
    FROM "monthlyReportGenerations"
    WHERE "userKey" = ${input.userKey}
      AND "snapshotMonth" = ${input.snapshotMonth}
    LIMIT 1
  ` as Array<{ leagueId?: string | null; createdAt: Date | string }>;

  return {
    allowed: false,
    userKey: input.userKey,
    snapshotMonth: input.snapshotMonth,
    existing: existing[0]
      ? {
          leagueId: existing[0].leagueId ?? null,
          createdAt: new Date(existing[0].createdAt),
        }
      : null,
  };
}

export async function findLeagueReportCache(cacheKey: string, maxAgeMs: number): Promise<unknown | null> {
  const sql = await getDb();
  if (!sql) return null;

  const freshAfter = new Date(Date.now() - maxAgeMs);
  const result = await sql`
    SELECT payload
    FROM "leagueReportCache"
    WHERE "cacheKey" = ${cacheKey}
      AND "updatedAt" >= ${freshAfter}
    LIMIT 1
  ` as Array<{ payload?: string | null }>;

  const payload = result[0]?.payload;
  if (!payload) return null;

  try {
    return JSON.parse(payload);
  } catch (error) {
    console.warn("[Database] Failed to parse league report cache:", error);
    return null;
  }
}

export async function upsertLeagueReportCache(input: {
  cacheKey: string;
  leagueId: string;
  viewerUserId?: string | null;
  payload: unknown;
}): Promise<void> {
  const sql = await getDb();
  if (!sql) return;

  const payload = JSON.stringify(input.payload);
  await sql`
    INSERT INTO "leagueReportCache" (
      "cacheKey",
      "leagueId",
      "viewerUserId",
      payload,
      "updatedAt"
    )
    VALUES (
      ${input.cacheKey},
      ${input.leagueId},
      ${input.viewerUserId ?? null},
      ${payload},
      NOW()
    )
    ON CONFLICT ("cacheKey") DO UPDATE SET
      "leagueId" = EXCLUDED."leagueId",
      "viewerUserId" = EXCLUDED."viewerUserId",
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()
  `;
}

export async function listLeagueReportCacheEntries(limit = 100): Promise<Array<{
  cacheKey: string;
  leagueId: string;
  viewerUserId: string | null;
  payload: unknown;
  updatedAt: Date;
}>> {
  const sql = await getDb();
  if (!sql) return [];

  const boundedLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const result = await sql`
    SELECT "cacheKey", "leagueId", "viewerUserId", payload, "updatedAt"
    FROM "leagueReportCache"
    ORDER BY "updatedAt" DESC
    LIMIT ${boundedLimit}
  ` as Array<{
    cacheKey?: string | null;
    leagueId?: string | null;
    viewerUserId?: string | null;
    payload?: string | null;
    updatedAt?: Date | string | null;
  }>;

  return result
    .filter((row) => row.cacheKey && row.leagueId && row.payload)
    .map((row) => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(String(row.payload || 'null'));
      } catch (error) {
        console.warn("[Database] Failed to parse cached league report during list:", error);
      }

      return {
        cacheKey: String(row.cacheKey),
        leagueId: String(row.leagueId),
        viewerUserId: row.viewerUserId ? String(row.viewerUserId) : null,
        payload,
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      };
    })
    .filter((entry) => Boolean(entry.payload));
}

export async function upsertMonthlyRosterBlueprintSnapshots(input: {
  leagueId: string;
  snapshotMonth: string;
  snapshots: Array<{
    manager: string;
    payload: unknown;
  }>;
}): Promise<boolean> {
  const sql = await getDb();
  if (!sql || !input.snapshots.length) return false;

  for (const snapshot of input.snapshots) {
    await sql`
      INSERT INTO "monthlyRosterBlueprintSnapshots" (
        "leagueId",
        manager,
        "snapshotMonth",
        payload,
        "updatedAt"
      )
      VALUES (
        ${input.leagueId},
        ${snapshot.manager},
        ${input.snapshotMonth},
        ${JSON.stringify(snapshot.payload)},
        NOW()
      )
      ON CONFLICT ("leagueId", manager, "snapshotMonth") DO UPDATE SET
        payload = EXCLUDED.payload,
        "updatedAt" = NOW()
    `;
  }

  return true;
}

export async function listMonthlyRosterBlueprintSnapshots(input: {
  leagueId: string;
  months?: number;
}): Promise<unknown[]> {
  const sql = await getDb();
  if (!sql) return [];

  const limit = Math.max(1, Math.min(Number(input.months) || 6, 24)) * 32;
  const result = await sql`
    SELECT payload
    FROM "monthlyRosterBlueprintSnapshots"
    WHERE "leagueId" = ${input.leagueId}
    ORDER BY "snapshotMonth" DESC, manager ASC
    LIMIT ${limit}
  ` as Array<{ payload?: string | null }>;

  return result
    .map((row) => {
      if (!row.payload) return null;
      try {
        return JSON.parse(row.payload);
      } catch (error) {
        console.warn("[Database] Failed to parse monthly blueprint snapshot:", error);
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeActionPlanRow(row: any): ActionPlanRecord | null {
  try {
    const kind = row.kind === "waiver" || row.kind === "trade" ? row.kind : "lineup";
    const status = ["submitted", "copied", "opened", "tracked", "won", "lost", "acted", "blocked"].includes(row.status)
      ? row.status
      : "saved";
    return {
      id: String(row.planId),
      kind,
      leagueId: row.leagueId ?? undefined,
      manager: row.manager ?? null,
      playerId: row.playerId ?? undefined,
      replacementPlayerId: row.replacementPlayerId ?? undefined,
      createdAt: new Date(row.createdAt).getTime(),
      updatedAt: new Date(row.updatedAt).getTime(),
      title: String(row.title || "Saved plan"),
      summary: String(row.summary || ""),
      status,
      payload: row.payload ? JSON.parse(row.payload) : {},
    };
  } catch (error) {
    console.warn("[Database] Failed to parse action plan:", error);
    return null;
  }
}

function normalizeWaiverBidHistoryRow(row: any): WaiverBidHistoryRecord {
  return {
    id: String(row.historyId),
    leagueId: row.leagueId ?? undefined,
    manager: row.manager ?? null,
    playerId: String(row.playerId),
    playerName: String(row.playerName || "Unknown Player"),
    position: String(row.position || ""),
    bidMin: Number(row.bidMin || 0),
    bidMax: Number(row.bidMax || 0),
    bidLabel: String(row.bidLabel || ""),
    source: row.source === "league-history" || row.source === "model" ? row.source : "submitted-plan",
    createdAt: new Date(row.createdAt).getTime(),
    updatedAt: new Date(row.updatedAt).getTime(),
  };
}

export async function upsertActionPlan(input: {
  userKey: string;
  plan: ActionPlanRecord;
}): Promise<boolean> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert action plan: database not available");
    return false;
  }

  await sql`
    INSERT INTO "actionPlans" (
      "userKey",
      "planId",
      kind,
      "leagueId",
      manager,
      "playerId",
      "replacementPlayerId",
      title,
      summary,
      status,
      payload,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${input.userKey},
      ${input.plan.id},
      ${input.plan.kind},
      ${input.plan.leagueId ?? null},
      ${input.plan.manager ?? null},
      ${input.plan.playerId ?? null},
      ${input.plan.replacementPlayerId ?? null},
      ${input.plan.title},
      ${input.plan.summary},
      ${input.plan.status},
      ${JSON.stringify(input.plan.payload || {})},
      ${new Date(input.plan.createdAt || Date.now())},
      NOW()
    )
    ON CONFLICT ("userKey", "planId") DO UPDATE SET
      kind = EXCLUDED.kind,
      "leagueId" = EXCLUDED."leagueId",
      manager = EXCLUDED.manager,
      "playerId" = EXCLUDED."playerId",
      "replacementPlayerId" = EXCLUDED."replacementPlayerId",
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      status = EXCLUDED.status,
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listActionPlans(input: {
  userKey: string;
  leagueId?: string | null;
  limit?: number;
}): Promise<ActionPlanRecord[]> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list action plans: database not available");
    return [];
  }

  const limit = Math.max(1, Math.min(Number(input.limit) || 50, 100));
  const result = input.leagueId
    ? await sql`
        SELECT
          "planId",
          kind,
          "leagueId",
          manager,
          "playerId",
          "replacementPlayerId",
          title,
          summary,
          status,
          payload,
          "createdAt",
          "updatedAt"
        FROM "actionPlans"
        WHERE "userKey" = ${input.userKey}
          AND "leagueId" = ${input.leagueId}
        ORDER BY "updatedAt" DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          "planId",
          kind,
          "leagueId",
          manager,
          "playerId",
          "replacementPlayerId",
          title,
          summary,
          status,
          payload,
          "createdAt",
          "updatedAt"
        FROM "actionPlans"
        WHERE "userKey" = ${input.userKey}
        ORDER BY "updatedAt" DESC
        LIMIT ${limit}
      `;

  return (result as Record<string, any>[])
    .map(normalizeActionPlanRow)
    .filter((plan): plan is ActionPlanRecord => Boolean(plan));
}

export async function upsertWaiverBidHistory(input: {
  userKey: string;
  item: WaiverBidHistoryRecord;
}): Promise<boolean> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert waiver bid history: database not available");
    return false;
  }

  await sql`
    INSERT INTO "waiverBidHistory" (
      "userKey",
      "historyId",
      "leagueId",
      manager,
      "playerId",
      "playerName",
      position,
      "bidMin",
      "bidMax",
      "bidLabel",
      source,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${input.userKey},
      ${input.item.id},
      ${input.item.leagueId ?? null},
      ${input.item.manager ?? null},
      ${input.item.playerId},
      ${input.item.playerName},
      ${input.item.position},
      ${input.item.bidMin},
      ${input.item.bidMax},
      ${input.item.bidLabel},
      ${input.item.source},
      ${new Date(input.item.createdAt || Date.now())},
      NOW()
    )
    ON CONFLICT ("userKey", "historyId") DO UPDATE SET
      "leagueId" = EXCLUDED."leagueId",
      manager = EXCLUDED.manager,
      "playerId" = EXCLUDED."playerId",
      "playerName" = EXCLUDED."playerName",
      position = EXCLUDED.position,
      "bidMin" = EXCLUDED."bidMin",
      "bidMax" = EXCLUDED."bidMax",
      "bidLabel" = EXCLUDED."bidLabel",
      source = EXCLUDED.source,
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listWaiverBidHistory(input: {
  userKey: string;
  leagueId?: string | null;
  limit?: number;
}): Promise<WaiverBidHistoryRecord[]> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list waiver bid history: database not available");
    return [];
  }

  const limit = Math.max(1, Math.min(Number(input.limit) || 80, 150));
  const result = input.leagueId
    ? await sql`
        SELECT
          "historyId",
          "leagueId",
          manager,
          "playerId",
          "playerName",
          position,
          "bidMin",
          "bidMax",
          "bidLabel",
          source,
          "createdAt",
          "updatedAt"
        FROM "waiverBidHistory"
        WHERE "userKey" = ${input.userKey}
          AND "leagueId" = ${input.leagueId}
        ORDER BY "updatedAt" DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          "historyId",
          "leagueId",
          manager,
          "playerId",
          "playerName",
          position,
          "bidMin",
          "bidMax",
          "bidLabel",
          source,
          "createdAt",
          "updatedAt"
        FROM "waiverBidHistory"
        WHERE "userKey" = ${input.userKey}
        ORDER BY "updatedAt" DESC
        LIMIT ${limit}
      `;

  return (result as Record<string, any>[]).map(normalizeWaiverBidHistoryRow);
}
