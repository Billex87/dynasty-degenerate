import { neon } from "@neondatabase/serverless";
import type { InsertUser, User } from "../drizzle/schema";
import { ENV } from "./_core/env";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;
let schemaReady: Promise<void> | null = null;

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
    console.warn("[Database] Cannot upsert user: database not available");
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
    console.warn("[Database] Cannot get user: database not available");
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
