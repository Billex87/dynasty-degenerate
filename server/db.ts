import { neon } from "@neondatabase/serverless";
import type { InsertUser, User } from "../drizzle/schema";
import { ENV } from "./_core/env";

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

  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
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
