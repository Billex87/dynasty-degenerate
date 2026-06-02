import { neon } from "@neondatabase/serverless";
import { gzipSync, gunzipSync } from "node:zlib";
import type { InsertUser, User } from "../drizzle/schema";
import type { ActionPlanRecord, ActionPlanStatus, SleeperHiddenLeagueSnapshot, SleeperWaiverClaimSignal, TradeProposalSignal, WaiverBidHistoryRecord } from "../shared/types";
import type { AIPredictionEvent, AIPredictionOutcome } from "./aiPredictionCalibration";
import type { MagicLinkTokenRecord } from "./magicLinkTokens";

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
const LEAGUE_REPORT_CACHE_COMPRESSION_THRESHOLD_BYTES = 256 * 1024;
const LEAGUE_REPORT_CACHE_ENCODING = "gzip-base64";

function serializeTextPayloadForStorage(payload: string): string {
  if (Buffer.byteLength(payload, "utf8") < LEAGUE_REPORT_CACHE_COMPRESSION_THRESHOLD_BYTES) {
    return payload;
  }

  return JSON.stringify({
    __ddCacheEncoding: LEAGUE_REPORT_CACHE_ENCODING,
    v: 1,
    payload: gzipSync(payload).toString("base64"),
  });
}

function parseTextPayloadFromStorage(payload: string): string {
  const parsed = JSON.parse(payload);
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).__ddCacheEncoding === LEAGUE_REPORT_CACHE_ENCODING &&
    typeof (parsed as Record<string, unknown>).payload === "string"
  ) {
    return gunzipSync(Buffer.from(String((parsed as Record<string, unknown>).payload), "base64")).toString("utf8");
  }
  return payload;
}

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

export type PlayerValueSnapshotInsert = {
  snapshotDate: string;
  profileKey: string;
  playerKey: string;
  name: string;
  value: number;
  rank?: string | null;
  sourceCount: number;
  sources: string[];
  sourceValues: Record<string, number | null>;
};

export type StoredPlayerValueSnapshot = PlayerValueSnapshotInsert & {
  dateKey: string;
};

export type StoredKtcSnapshotPayload = {
  snapshotDate: Date;
  ktcData: string;
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

export type StoredSnapshotMetadata = {
  sourceKey: string;
  source: string;
  snapshotKey: string | null;
  updatedAt: Date | null;
  payloadSizeBytes: number | null;
  tableName: string;
};

export type LeagueReportCacheMetadata = {
  cacheKey: string;
  leagueId: string;
  viewerUserId: string | null;
  updatedAt: Date;
  payloadSizeBytes: number;
};

export type AiPredictionEventRecord = AIPredictionEvent & {
  userKey?: string | null;
  updatedAt?: string | null;
};

export type UsageEventInput = {
  eventId: string;
  userOpenId?: string | null;
  leagueId?: string | null;
  featureKey: string;
  usageKey: string;
  quantity?: number | null;
  source: string;
  metadata?: unknown;
  createdAt?: Date | string | null;
};

export type BillingCustomerUpsertInput = {
  userId?: number | null;
  userOpenId: string;
  stripeCustomerId: string;
  email?: string | null;
  name?: string | null;
  status?: string | null;
  metadata?: unknown;
};

export type BillingSubscriptionUpsertInput = {
  userId?: number | null;
  userOpenId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: string;
  status: string;
  priceId?: string | null;
  productId?: string | null;
  currentPeriodStart?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean | number | null;
  metadata?: unknown;
};

export type BillingSubscriptionAccessRecord = {
  plan: string | null;
  status: string;
  currentPeriodEnd: Date | null;
};

export type BillingCustomerAccessRecord = {
  stripeCustomerId: string;
  email: string | null;
  status: string;
  updatedAt: Date | null;
};

export type LeaguePassUpsertInput = {
  leagueId: string;
  purchaserUserId?: number | null;
  purchaserOpenId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId: string;
  status: string;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  maxManagers?: number | null;
  metadata?: unknown;
};

export type LeaguePassAccessRecord = {
  leagueId: string;
  purchaserOpenId: string;
  status: string;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxManagers: number | null;
  metadata: unknown;
};

export type FeatureEntitlementUpsertInput = {
  subjectType: "user" | "league";
  userOpenId?: string | null;
  leagueId?: string | null;
  featureKey: string;
  plan?: string | null;
  source: string;
  sourceId: string;
  status: string;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  metadata?: unknown;
};

export type FeatureEntitlementAccessRecord = {
  subjectType: "user" | "league" | string;
  userOpenId: string | null;
  leagueId: string | null;
  featureKey: string;
  plan: string | null;
  status: string;
  startsAt: Date | null;
  expiresAt: Date | null;
};

export type CountUsageEventsInput = {
  userOpenId?: string | null;
  leagueId?: string | null;
  featureKey?: string | null;
  usageKey?: string | null;
  createdAtFrom?: Date | string | null;
  createdAtTo?: Date | string | null;
};

export type UserSleeperAccountInput = {
  userOpenId: string;
  sleeperUserId: string;
  sleeperUsername: string;
  displayName?: string | null;
  avatar?: string | null;
  isPrimary?: boolean | number | null;
  metadata?: unknown;
};

export type UserSleeperAccountRecord = {
  sleeperUserId: string;
  sleeperUsername: string;
  displayName: string | null;
  avatar: string | null;
  isPrimary: boolean;
  updatedAt: Date | null;
};

export type UserFavoriteLeagueInput = {
  userOpenId: string;
  leagueId: string;
  leagueName?: string | null;
  platform?: string | null;
  sleeperUserId?: string | null;
  metadata?: unknown;
};

export type UserFavoriteLeagueRecord = {
  leagueId: string;
  leagueName: string | null;
  platform: string;
  sleeperUserId: string | null;
  updatedAt: Date | null;
};

export type UserRecentReportInput = {
  userOpenId: string;
  leagueId: string;
  leagueName?: string | null;
  sleeperUsername?: string | null;
  sleeperUserId?: string | null;
  platform?: string | null;
  metadata?: unknown;
  lastViewedAt?: Date | string | null;
};

export type UserRecentReportRecord = {
  leagueId: string;
  leagueName: string | null;
  sleeperUsername: string | null;
  sleeperUserId: string | null;
  platform: string;
  lastViewedAt: Date | null;
};

export type UserNotificationPreferencesInput = {
  userOpenId: string;
  billingEmails?: boolean | number | null;
  productEmails?: boolean | number | null;
  reportAlerts?: boolean | number | null;
  anomalyAlerts?: boolean | number | null;
  weeklyDigest?: boolean | number | null;
  metadata?: unknown;
};

export type UserNotificationPreferencesRecord = {
  billingEmails: boolean;
  productEmails: boolean;
  reportAlerts: boolean;
  anomalyAlerts: boolean;
  weeklyDigest: boolean;
  updatedAt: Date | null;
};

function getSql() {
  if (!process.env.DATABASE_URL) return null;
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

export function serializeLeagueReportCachePayloadForStorage(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  return serializeTextPayloadForStorage(serialized);
}

export function parseLeagueReportCachePayloadFromStorage(payload: string): unknown {
  return JSON.parse(parseTextPayloadFromStorage(payload));
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
        CREATE TABLE IF NOT EXISTS "magicLinkTokens" (
          id SERIAL PRIMARY KEY,
          "tokenId" VARCHAR(128) NOT NULL UNIQUE,
          email VARCHAR(320) NOT NULL,
          "tokenHash" VARCHAR(64) NOT NULL UNIQUE,
          purpose VARCHAR(32) NOT NULL DEFAULT 'login',
          "redirectPath" TEXT,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          "expiresAt" TIMESTAMPTZ NOT NULL,
          "consumedAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "magicLinkTokens_email_createdAt_idx"
        ON "magicLinkTokens" (email, "createdAt" DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "magicLinkTokens_expiresAt_idx"
        ON "magicLinkTokens" ("expiresAt")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "magicLinkTokens_token_hash_idx"
        ON "magicLinkTokens" ("tokenHash")
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "billingCustomers" (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER,
          "userOpenId" VARCHAR(64) NOT NULL,
          "stripeCustomerId" VARCHAR(128) NOT NULL UNIQUE,
          email VARCHAR(320),
          name TEXT,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          metadata TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "billingCustomers_user_open_id_idx"
        ON "billingCustomers" ("userOpenId")
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER,
          "userOpenId" VARCHAR(64) NOT NULL,
          "stripeCustomerId" VARCHAR(128) NOT NULL,
          "stripeSubscriptionId" VARCHAR(128) NOT NULL UNIQUE,
          plan VARCHAR(32) NOT NULL,
          status VARCHAR(32) NOT NULL,
          "priceId" VARCHAR(128),
          "productId" VARCHAR(128),
          "currentPeriodStart" TIMESTAMPTZ,
          "currentPeriodEnd" TIMESTAMPTZ,
          "cancelAtPeriodEnd" INTEGER NOT NULL DEFAULT 0,
          metadata TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "subscriptions_user_status_idx"
        ON subscriptions ("userOpenId", status)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "subscriptions_stripe_customer_idx"
        ON subscriptions ("stripeCustomerId")
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "leaguePasses" (
          id SERIAL PRIMARY KEY,
          "leagueId" VARCHAR(64) NOT NULL,
          "purchaserUserId" INTEGER,
          "purchaserOpenId" VARCHAR(64) NOT NULL,
          "stripeCustomerId" VARCHAR(128),
          "stripeSubscriptionId" VARCHAR(128),
          "stripeCheckoutSessionId" VARCHAR(128),
          status VARCHAR(32) NOT NULL,
          "startsAt" TIMESTAMPTZ,
          "expiresAt" TIMESTAMPTZ,
          "maxManagers" INTEGER,
          metadata TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "leaguePasses_league_status_idx"
        ON "leaguePasses" ("leagueId", status)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "leaguePasses_purchaser_idx"
        ON "leaguePasses" ("purchaserOpenId")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "leaguePasses_stripe_checkout_idx"
        ON "leaguePasses" ("stripeCheckoutSessionId")
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "featureEntitlements" (
          id SERIAL PRIMARY KEY,
          "subjectType" VARCHAR(16) NOT NULL,
          "userOpenId" VARCHAR(64),
          "leagueId" VARCHAR(64),
          "featureKey" VARCHAR(64) NOT NULL,
          plan VARCHAR(32),
          source VARCHAR(32) NOT NULL,
          "sourceId" VARCHAR(128),
          status VARCHAR(32) NOT NULL,
          "startsAt" TIMESTAMPTZ,
          "expiresAt" TIMESTAMPTZ,
          metadata TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "featureEntitlements_user_feature_idx"
        ON "featureEntitlements" ("userOpenId", "featureKey", status)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "featureEntitlements_league_feature_idx"
        ON "featureEntitlements" ("leagueId", "featureKey", status)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "featureEntitlements_source_idx"
        ON "featureEntitlements" (source, "sourceId")
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "usageEvents" (
          id SERIAL PRIMARY KEY,
          "eventId" VARCHAR(128) NOT NULL UNIQUE,
          "userOpenId" VARCHAR(64),
          "leagueId" VARCHAR(64),
          "featureKey" VARCHAR(64) NOT NULL,
          "usageKey" VARCHAR(64) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          source VARCHAR(32) NOT NULL,
          metadata TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "usageEvents_user_feature_createdAt_idx"
        ON "usageEvents" ("userOpenId", "featureKey", "createdAt" DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "usageEvents_league_feature_createdAt_idx"
        ON "usageEvents" ("leagueId", "featureKey", "createdAt" DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "usageEvents_feature_usage_key_idx"
        ON "usageEvents" ("featureKey", "usageKey")
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "userSleeperAccounts" (
          id SERIAL PRIMARY KEY,
          "userOpenId" VARCHAR(64) NOT NULL,
          "sleeperUserId" VARCHAR(64) NOT NULL,
          "sleeperUsername" VARCHAR(64) NOT NULL,
          "displayName" TEXT,
          avatar TEXT,
          "isPrimary" INTEGER NOT NULL DEFAULT 0,
          metadata TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "userSleeperAccounts_user_sleeper_uidx"
        ON "userSleeperAccounts" ("userOpenId", "sleeperUserId")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "userSleeperAccounts_user_username_idx"
        ON "userSleeperAccounts" ("userOpenId", "sleeperUsername")
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "userFavoriteLeagues" (
          id SERIAL PRIMARY KEY,
          "userOpenId" VARCHAR(64) NOT NULL,
          "leagueId" VARCHAR(64) NOT NULL,
          "leagueName" TEXT,
          platform VARCHAR(32) NOT NULL DEFAULT 'sleeper',
          "sleeperUserId" VARCHAR(64),
          metadata TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "userFavoriteLeagues_user_league_uidx"
        ON "userFavoriteLeagues" ("userOpenId", "leagueId")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "userFavoriteLeagues_user_updatedAt_idx"
        ON "userFavoriteLeagues" ("userOpenId", "updatedAt" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "userRecentReports" (
          id SERIAL PRIMARY KEY,
          "userOpenId" VARCHAR(64) NOT NULL,
          "leagueId" VARCHAR(64) NOT NULL,
          "leagueName" TEXT,
          "sleeperUsername" VARCHAR(64),
          "sleeperUserId" VARCHAR(64),
          platform VARCHAR(32) NOT NULL DEFAULT 'sleeper',
          metadata TEXT,
          "lastViewedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "userRecentReports_user_league_uidx"
        ON "userRecentReports" ("userOpenId", "leagueId")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "userRecentReports_user_viewed_idx"
        ON "userRecentReports" ("userOpenId", "lastViewedAt" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "userNotificationPreferences" (
          id SERIAL PRIMARY KEY,
          "userOpenId" VARCHAR(64) NOT NULL UNIQUE,
          "billingEmails" INTEGER NOT NULL DEFAULT 1,
          "productEmails" INTEGER NOT NULL DEFAULT 1,
          "reportAlerts" INTEGER NOT NULL DEFAULT 0,
          "anomalyAlerts" INTEGER NOT NULL DEFAULT 0,
          "weeklyDigest" INTEGER NOT NULL DEFAULT 0,
          metadata TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "userNotificationPreferences_user_open_id_idx"
        ON "userNotificationPreferences" ("userOpenId")
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
        CREATE TABLE IF NOT EXISTS "playerValueSnapshots" (
          id SERIAL PRIMARY KEY,
          "snapshotDate" TIMESTAMPTZ NOT NULL,
          "profileKey" VARCHAR(64) NOT NULL,
          "playerKey" TEXT NOT NULL,
          name TEXT NOT NULL,
          value INTEGER NOT NULL,
          rank TEXT,
          "sourceCount" INTEGER NOT NULL DEFAULT 0,
          sources JSONB NOT NULL DEFAULT '[]'::jsonb,
          "sourceValues" JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "playerValueSnapshots_unique_snapshot_player"
        ON "playerValueSnapshots" ("snapshotDate", "profileKey", "playerKey")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "playerValueSnapshots_profile_player_date_idx"
        ON "playerValueSnapshots" ("profileKey", "playerKey", "snapshotDate" DESC)
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
        CREATE TABLE IF NOT EXISTS "aiPredictionEvents" (
          id SERIAL PRIMARY KEY,
          "eventId" TEXT NOT NULL UNIQUE,
          "predictionKey" TEXT NOT NULL,
          "userKey" TEXT,
          "leagueId" TEXT,
          surface VARCHAR(32) NOT NULL,
          action VARCHAR(32) NOT NULL,
          decision VARCHAR(16) NOT NULL,
          "entityType" VARCHAR(32) NOT NULL,
          "entityId" TEXT,
          "entityName" TEXT,
          manager TEXT,
          label VARCHAR(32) NOT NULL,
          "finalScore" INTEGER NOT NULL,
          "confidenceCap" INTEGER NOT NULL DEFAULT 100,
          "outcomeStatus" VARCHAR(16) NOT NULL DEFAULT 'pending',
          "outcomeValue" DOUBLE PRECISION,
          "baselineValue" DOUBLE PRECISION,
          "resolvedAt" TIMESTAMPTZ,
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "aiPredictionEvents_user_league_updatedAt_idx"
        ON "aiPredictionEvents" ("userKey", "leagueId", "updatedAt" DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "aiPredictionEvents_prediction_key_idx"
        ON "aiPredictionEvents" ("predictionKey", "updatedAt" DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "aiPredictionEvents_surface_action_createdAt_idx"
        ON "aiPredictionEvents" (surface, action, "createdAt" DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "aiPredictionEvents_outcome_status_idx"
        ON "aiPredictionEvents" ("outcomeStatus", "updatedAt" DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS "providerDataSnapshots" (
          id SERIAL PRIMARY KEY,
          "sourceKey" VARCHAR(128) NOT NULL,
          "snapshotKey" VARCHAR(64) NOT NULL,
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "providerDataSnapshots_source_key_uidx"
        ON "providerDataSnapshots" ("sourceKey", "snapshotKey")
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "providerDataSnapshots_source_key_idx"
        ON "providerDataSnapshots" ("sourceKey", "snapshotKey" DESC)
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
        CREATE TABLE IF NOT EXISTS "sleeperHiddenLeagueSnapshots" (
          id SERIAL PRIMARY KEY,
          "leagueId" TEXT NOT NULL UNIQUE,
          "sharedBy" TEXT,
          "sharedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          payload TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS "sleeperHiddenLeagueSnapshots_league_updatedAt_idx"
        ON "sleeperHiddenLeagueSnapshots" ("leagueId", "updatedAt" DESC)
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

function normalizeMagicLinkTokenRow(row: any): MagicLinkTokenRecord {
  return {
    tokenId: String(row.tokenId),
    email: String(row.email),
    tokenHash: String(row.tokenHash),
    purpose: "login",
    redirectPath: row.redirectPath ?? null,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt),
    consumedAt: row.consumedAt ? row.consumedAt instanceof Date ? row.consumedAt : new Date(row.consumedAt) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}

function requiredTrimmed(value: string | null | undefined, label: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function optionalTrimmed(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizeDateForDb(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function serializeMetadataForDb(metadata: unknown): string | null {
  if (metadata === undefined || metadata === null) return null;
  return JSON.stringify(metadata);
}

function parseMetadataFromDb(metadata: unknown): unknown {
  if (metadata === undefined || metadata === null || metadata === "") return null;
  if (typeof metadata !== "string") return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
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

export async function insertMagicLinkToken(record: MagicLinkTokenRecord): Promise<boolean> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot insert magic link token: database not available");
    return false;
  }

  await sql`
    INSERT INTO "magicLinkTokens" (
      "tokenId",
      email,
      "tokenHash",
      purpose,
      "redirectPath",
      "ipAddress",
      "userAgent",
      "expiresAt",
      "consumedAt",
      "createdAt"
    )
    VALUES (
      ${record.tokenId},
      ${record.email},
      ${record.tokenHash},
      ${record.purpose},
      ${record.redirectPath ?? null},
      ${record.ipAddress ?? null},
      ${record.userAgent ?? null},
      ${record.expiresAt},
      ${record.consumedAt ?? null},
      ${record.createdAt}
    )
    ON CONFLICT ("tokenId") DO NOTHING
  `;

  return true;
}

export async function findMagicLinkTokenByHash(tokenHash: string): Promise<MagicLinkTokenRecord | null> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot find magic link token: database not available");
    return null;
  }

  const result = await sql`
    SELECT
      "tokenId",
      email,
      "tokenHash",
      purpose,
      "redirectPath",
      "ipAddress",
      "userAgent",
      "expiresAt",
      "consumedAt",
      "createdAt"
    FROM "magicLinkTokens"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  ` as Record<string, any>[];

  return result.length > 0 ? normalizeMagicLinkTokenRow(result[0]) : null;
}

export async function markMagicLinkTokenConsumed(input: {
  tokenId: string;
  consumedAt: Date;
}): Promise<MagicLinkTokenRecord | null> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot consume magic link token: database not available");
    return null;
  }

  const result = await sql`
    UPDATE "magicLinkTokens"
    SET "consumedAt" = ${input.consumedAt}
    WHERE "tokenId" = ${input.tokenId}
      AND "consumedAt" IS NULL
      AND "expiresAt" > ${input.consumedAt}
    RETURNING
      "tokenId",
      email,
      "tokenHash",
      purpose,
      "redirectPath",
      "ipAddress",
      "userAgent",
      "expiresAt",
      "consumedAt",
      "createdAt"
  ` as Record<string, any>[];

  return result.length > 0 ? normalizeMagicLinkTokenRow(result[0]) : null;
}

export async function upsertBillingCustomer(input: BillingCustomerUpsertInput): Promise<boolean> {
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const stripeCustomerId = requiredTrimmed(input.stripeCustomerId, "stripeCustomerId");
  const status = optionalTrimmed(input.status) ?? "active";
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert billing customer: database not available");
    return false;
  }

  await sql`
    INSERT INTO "billingCustomers" (
      "userId",
      "userOpenId",
      "stripeCustomerId",
      email,
      name,
      status,
      metadata,
      "updatedAt"
    )
    VALUES (
      ${input.userId ?? null},
      ${userOpenId},
      ${stripeCustomerId},
      ${optionalTrimmed(input.email)},
      ${optionalTrimmed(input.name)},
      ${status},
      ${serializeMetadataForDb(input.metadata)},
      NOW()
    )
    ON CONFLICT ("stripeCustomerId") DO UPDATE SET
      "userId" = COALESCE(EXCLUDED."userId", "billingCustomers"."userId"),
      "userOpenId" = EXCLUDED."userOpenId",
      email = COALESCE(EXCLUDED.email, "billingCustomers".email),
      name = COALESCE(EXCLUDED.name, "billingCustomers".name),
      status = EXCLUDED.status,
      metadata = COALESCE(EXCLUDED.metadata, "billingCustomers".metadata),
      "updatedAt" = NOW()
  `;

  return true;
}

export async function upsertBillingSubscription(input: BillingSubscriptionUpsertInput): Promise<boolean> {
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const stripeCustomerId = requiredTrimmed(input.stripeCustomerId, "stripeCustomerId");
  const stripeSubscriptionId = requiredTrimmed(input.stripeSubscriptionId, "stripeSubscriptionId");
  const plan = requiredTrimmed(input.plan, "plan").toLowerCase();
  const status = requiredTrimmed(input.status, "status").toLowerCase();
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert billing subscription: database not available");
    return false;
  }

  await sql`
    INSERT INTO subscriptions (
      "userId",
      "userOpenId",
      "stripeCustomerId",
      "stripeSubscriptionId",
      plan,
      status,
      "priceId",
      "productId",
      "currentPeriodStart",
      "currentPeriodEnd",
      "cancelAtPeriodEnd",
      metadata,
      "updatedAt"
    )
    VALUES (
      ${input.userId ?? null},
      ${userOpenId},
      ${stripeCustomerId},
      ${stripeSubscriptionId},
      ${plan},
      ${status},
      ${optionalTrimmed(input.priceId)},
      ${optionalTrimmed(input.productId)},
      ${normalizeDateForDb(input.currentPeriodStart)},
      ${normalizeDateForDb(input.currentPeriodEnd)},
      ${input.cancelAtPeriodEnd ? 1 : 0},
      ${serializeMetadataForDb(input.metadata)},
      NOW()
    )
    ON CONFLICT ("stripeSubscriptionId") DO UPDATE SET
      "userId" = COALESCE(EXCLUDED."userId", subscriptions."userId"),
      "userOpenId" = EXCLUDED."userOpenId",
      "stripeCustomerId" = EXCLUDED."stripeCustomerId",
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      "priceId" = COALESCE(EXCLUDED."priceId", subscriptions."priceId"),
      "productId" = COALESCE(EXCLUDED."productId", subscriptions."productId"),
      "currentPeriodStart" = EXCLUDED."currentPeriodStart",
      "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
      "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd",
      metadata = COALESCE(EXCLUDED.metadata, subscriptions.metadata),
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listBillingSubscriptionsForUser(userOpenId: string): Promise<BillingSubscriptionAccessRecord[]> {
  const normalizedUserOpenId = requiredTrimmed(userOpenId, "userOpenId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list billing subscriptions: database not available");
    return [];
  }

  const result = await sql`
    SELECT
      plan,
      status,
      "currentPeriodEnd"
    FROM subscriptions
    WHERE "userOpenId" = ${normalizedUserOpenId}
    ORDER BY "updatedAt" DESC
  ` as Record<string, any>[];

  return result.map((row) => ({
    plan: row.plan ?? null,
    status: String(row.status || ""),
    currentPeriodEnd: normalizeDateForDb(row.currentPeriodEnd),
  }));
}

export async function findBillingCustomerForUser(userOpenId: string): Promise<BillingCustomerAccessRecord | null> {
  const normalizedUserOpenId = requiredTrimmed(userOpenId, "userOpenId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot find billing customer: database not available");
    return null;
  }

  const result = await sql`
    SELECT
      "stripeCustomerId",
      email,
      status,
      "updatedAt"
    FROM "billingCustomers"
    WHERE "userOpenId" = ${normalizedUserOpenId}
    ORDER BY
      CASE WHEN status = 'active' THEN 0 ELSE 1 END,
      "updatedAt" DESC
    LIMIT 1
  ` as Record<string, any>[];

  const row = result[0];
  if (!row?.stripeCustomerId) return null;
  return {
    stripeCustomerId: String(row.stripeCustomerId),
    email: row.email ? String(row.email) : null,
    status: String(row.status || ""),
    updatedAt: normalizeDateForDb(row.updatedAt),
  };
}

export async function upsertLeaguePass(input: LeaguePassUpsertInput): Promise<boolean> {
  const leagueId = requiredTrimmed(input.leagueId, "leagueId");
  const purchaserOpenId = requiredTrimmed(input.purchaserOpenId, "purchaserOpenId");
  const stripeCheckoutSessionId = requiredTrimmed(input.stripeCheckoutSessionId, "stripeCheckoutSessionId");
  const status = requiredTrimmed(input.status, "status").toLowerCase();
  const maxManagers = input.maxManagers && Number.isFinite(input.maxManagers)
    ? Math.max(1, Math.floor(input.maxManagers))
    : null;
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert league pass: database not available");
    return false;
  }

  const updated = await sql`
    UPDATE "leaguePasses"
    SET
      "leagueId" = ${leagueId},
      "purchaserUserId" = COALESCE(${input.purchaserUserId ?? null}, "leaguePasses"."purchaserUserId"),
      "purchaserOpenId" = ${purchaserOpenId},
      "stripeCustomerId" = COALESCE(${optionalTrimmed(input.stripeCustomerId)}, "leaguePasses"."stripeCustomerId"),
      "stripeSubscriptionId" = COALESCE(${optionalTrimmed(input.stripeSubscriptionId)}, "leaguePasses"."stripeSubscriptionId"),
      status = ${status},
      "startsAt" = COALESCE(${normalizeDateForDb(input.startsAt)}, "leaguePasses"."startsAt"),
      "expiresAt" = ${normalizeDateForDb(input.expiresAt)},
      "maxManagers" = COALESCE(${maxManagers}, "leaguePasses"."maxManagers"),
      metadata = COALESCE(${serializeMetadataForDb(input.metadata)}, "leaguePasses".metadata),
      "updatedAt" = NOW()
    WHERE "stripeCheckoutSessionId" = ${stripeCheckoutSessionId}
    RETURNING id
  ` as Record<string, any>[];

  if (updated.length > 0) return true;

  await sql`
    INSERT INTO "leaguePasses" (
      "leagueId",
      "purchaserUserId",
      "purchaserOpenId",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "stripeCheckoutSessionId",
      status,
      "startsAt",
      "expiresAt",
      "maxManagers",
      metadata,
      "updatedAt"
    )
    VALUES (
      ${leagueId},
      ${input.purchaserUserId ?? null},
      ${purchaserOpenId},
      ${optionalTrimmed(input.stripeCustomerId)},
      ${optionalTrimmed(input.stripeSubscriptionId)},
      ${stripeCheckoutSessionId},
      ${status},
      ${normalizeDateForDb(input.startsAt)},
      ${normalizeDateForDb(input.expiresAt)},
      ${maxManagers},
      ${serializeMetadataForDb(input.metadata)},
      NOW()
    )
  `;

  return true;
}

export async function listActiveLeaguePassesForLeague(leagueId: string): Promise<LeaguePassAccessRecord[]> {
  const normalizedLeagueId = requiredTrimmed(leagueId, "leagueId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list league passes: database not available");
    return [];
  }

  const result = await sql`
    SELECT
      "leagueId",
      "purchaserOpenId",
      status,
      "startsAt",
      "expiresAt",
      "maxManagers",
      metadata
    FROM "leaguePasses"
    WHERE "leagueId" = ${normalizedLeagueId}
      AND status = 'active'
      AND ("startsAt" IS NULL OR "startsAt" <= NOW())
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    ORDER BY "updatedAt" DESC
  ` as Record<string, any>[];

  return result.map((row) => ({
    leagueId: String(row.leagueId || ""),
    purchaserOpenId: String(row.purchaserOpenId || ""),
    status: String(row.status || ""),
    startsAt: normalizeDateForDb(row.startsAt),
    expiresAt: normalizeDateForDb(row.expiresAt),
    maxManagers: row.maxManagers === null || row.maxManagers === undefined ? null : Number(row.maxManagers),
    metadata: parseMetadataFromDb(row.metadata),
  }));
}

export async function upsertFeatureEntitlement(input: FeatureEntitlementUpsertInput): Promise<boolean> {
  const subjectType = requiredTrimmed(input.subjectType, "subjectType").toLowerCase();
  if (subjectType !== "user" && subjectType !== "league") {
    throw new Error("subjectType must be user or league");
  }

  const featureKey = requiredTrimmed(input.featureKey, "featureKey");
  const source = requiredTrimmed(input.source, "source");
  const sourceId = requiredTrimmed(input.sourceId, "sourceId");
  const status = requiredTrimmed(input.status, "status").toLowerCase();
  const userOpenId = subjectType === "user"
    ? requiredTrimmed(input.userOpenId, "userOpenId")
    : optionalTrimmed(input.userOpenId);
  const leagueId = subjectType === "league"
    ? requiredTrimmed(input.leagueId, "leagueId")
    : optionalTrimmed(input.leagueId);
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert feature entitlement: database not available");
    return false;
  }

  const updated = await sql`
    UPDATE "featureEntitlements"
    SET
      "userOpenId" = ${userOpenId},
      "leagueId" = ${leagueId},
      plan = ${optionalTrimmed(input.plan)},
      status = ${status},
      "startsAt" = COALESCE(${normalizeDateForDb(input.startsAt)}, "featureEntitlements"."startsAt"),
      "expiresAt" = ${normalizeDateForDb(input.expiresAt)},
      metadata = COALESCE(${serializeMetadataForDb(input.metadata)}, "featureEntitlements".metadata),
      "updatedAt" = NOW()
    WHERE "subjectType" = ${subjectType}
      AND "featureKey" = ${featureKey}
      AND source = ${source}
      AND "sourceId" = ${sourceId}
    RETURNING id
  ` as Record<string, any>[];

  if (updated.length > 0) return true;

  await sql`
    INSERT INTO "featureEntitlements" (
      "subjectType",
      "userOpenId",
      "leagueId",
      "featureKey",
      plan,
      source,
      "sourceId",
      status,
      "startsAt",
      "expiresAt",
      metadata,
      "updatedAt"
    )
    VALUES (
      ${subjectType},
      ${userOpenId},
      ${leagueId},
      ${featureKey},
      ${optionalTrimmed(input.plan)},
      ${source},
      ${sourceId},
      ${status},
      ${normalizeDateForDb(input.startsAt)},
      ${normalizeDateForDb(input.expiresAt)},
      ${serializeMetadataForDb(input.metadata)},
      NOW()
    )
  `;

  return true;
}

function normalizeFeatureEntitlementAccessRow(row: Record<string, any>): FeatureEntitlementAccessRecord {
  return {
    subjectType: String(row.subjectType || ""),
    userOpenId: row.userOpenId ? String(row.userOpenId) : null,
    leagueId: row.leagueId ? String(row.leagueId) : null,
    featureKey: String(row.featureKey || ""),
    plan: row.plan ? String(row.plan) : null,
    status: String(row.status || ""),
    startsAt: normalizeDateForDb(row.startsAt),
    expiresAt: normalizeDateForDb(row.expiresAt),
  };
}

export async function listActiveFeatureEntitlementsForUser(userOpenId: string): Promise<FeatureEntitlementAccessRecord[]> {
  const normalizedUserOpenId = requiredTrimmed(userOpenId, "userOpenId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list user feature entitlements: database not available");
    return [];
  }

  const result = await sql`
    SELECT
      "subjectType",
      "userOpenId",
      "leagueId",
      "featureKey",
      plan,
      status,
      "startsAt",
      "expiresAt"
    FROM "featureEntitlements"
    WHERE "subjectType" = 'user'
      AND "userOpenId" = ${normalizedUserOpenId}
      AND status = 'active'
      AND ("startsAt" IS NULL OR "startsAt" <= NOW())
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    ORDER BY "updatedAt" DESC
  ` as Record<string, any>[];

  return result.map(normalizeFeatureEntitlementAccessRow);
}

export async function listActiveFeatureEntitlementsForLeague(leagueId: string): Promise<FeatureEntitlementAccessRecord[]> {
  const normalizedLeagueId = requiredTrimmed(leagueId, "leagueId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list league feature entitlements: database not available");
    return [];
  }

  const result = await sql`
    SELECT
      "subjectType",
      "userOpenId",
      "leagueId",
      "featureKey",
      plan,
      status,
      "startsAt",
      "expiresAt"
    FROM "featureEntitlements"
    WHERE "subjectType" = 'league'
      AND "leagueId" = ${normalizedLeagueId}
      AND status = 'active'
      AND ("startsAt" IS NULL OR "startsAt" <= NOW())
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    ORDER BY "updatedAt" DESC
  ` as Record<string, any>[];

  return result.map(normalizeFeatureEntitlementAccessRow);
}

export async function recordUsageEvent(input: UsageEventInput): Promise<boolean> {
  const eventId = requiredTrimmed(input.eventId, "eventId");
  const featureKey = requiredTrimmed(input.featureKey, "featureKey");
  const usageKey = requiredTrimmed(input.usageKey, "usageKey");
  const source = requiredTrimmed(input.source, "source");
  const quantity = Math.max(1, Math.floor(Number(input.quantity ?? 1)));
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot record usage event: database not available");
    return false;
  }

  await sql`
    INSERT INTO "usageEvents" (
      "eventId",
      "userOpenId",
      "leagueId",
      "featureKey",
      "usageKey",
      quantity,
      source,
      metadata,
      "createdAt"
    )
    VALUES (
      ${eventId},
      ${optionalTrimmed(input.userOpenId)},
      ${optionalTrimmed(input.leagueId)},
      ${featureKey},
      ${usageKey},
      ${quantity},
      ${source},
      ${serializeMetadataForDb(input.metadata)},
      ${normalizeDateForDb(input.createdAt) ?? new Date()}
    )
    ON CONFLICT ("eventId") DO NOTHING
  `;

  return true;
}

export async function countUsageEvents(input: CountUsageEventsInput): Promise<number> {
  const userOpenId = optionalTrimmed(input.userOpenId);
  const leagueId = optionalTrimmed(input.leagueId);
  const featureKey = optionalTrimmed(input.featureKey);
  const usageKey = optionalTrimmed(input.usageKey);
  const createdAtFrom = normalizeDateForDb(input.createdAtFrom);
  const createdAtTo = normalizeDateForDb(input.createdAtTo);
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot count usage events: database not available");
    return 0;
  }

  const result = await sql`
    SELECT COALESCE(SUM(quantity), 0)::int AS "usageCount"
    FROM "usageEvents"
    WHERE (${userOpenId}::text IS NULL OR "userOpenId" = ${userOpenId})
      AND (${leagueId}::text IS NULL OR "leagueId" = ${leagueId})
      AND (${featureKey}::text IS NULL OR "featureKey" = ${featureKey})
      AND (${usageKey}::text IS NULL OR "usageKey" = ${usageKey})
      AND (${createdAtFrom}::timestamptz IS NULL OR "createdAt" >= ${createdAtFrom})
      AND (${createdAtTo}::timestamptz IS NULL OR "createdAt" < ${createdAtTo})
  ` as Array<{ usageCount?: number | string | null }>;

  return Number(result[0]?.usageCount || 0);
}

function normalizeBooleanFlag(value: boolean | number | null | undefined, fallback: boolean): number {
  if (value === undefined || value === null) return fallback ? 1 : 0;
  if (typeof value === "number") return value ? 1 : 0;
  return value ? 1 : 0;
}

function parseBooleanFlag(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  return Number(value) === 1 || value === true;
}

function toAccountMetadata(metadata: unknown): string | null {
  return serializeMetadataForDb(metadata);
}

export async function upsertUserSleeperAccount(input: UserSleeperAccountInput): Promise<boolean> {
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const sleeperUserId = requiredTrimmed(input.sleeperUserId, "sleeperUserId");
  const sleeperUsername = requiredTrimmed(input.sleeperUsername, "sleeperUsername").toLowerCase();
  const isPrimary = normalizeBooleanFlag(input.isPrimary, false);
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert user Sleeper account: database not available");
    return false;
  }

  if (isPrimary) {
    await sql`
      UPDATE "userSleeperAccounts"
      SET "isPrimary" = 0, "updatedAt" = NOW()
      WHERE "userOpenId" = ${userOpenId}
    `;
  }

  await sql`
    INSERT INTO "userSleeperAccounts" (
      "userOpenId",
      "sleeperUserId",
      "sleeperUsername",
      "displayName",
      avatar,
      "isPrimary",
      metadata,
      "updatedAt"
    )
    VALUES (
      ${userOpenId},
      ${sleeperUserId},
      ${sleeperUsername},
      ${optionalTrimmed(input.displayName)},
      ${optionalTrimmed(input.avatar)},
      ${isPrimary},
      ${toAccountMetadata(input.metadata)},
      NOW()
    )
    ON CONFLICT ("userOpenId", "sleeperUserId") DO UPDATE SET
      "sleeperUsername" = EXCLUDED."sleeperUsername",
      "displayName" = COALESCE(EXCLUDED."displayName", "userSleeperAccounts"."displayName"),
      avatar = COALESCE(EXCLUDED.avatar, "userSleeperAccounts".avatar),
      "isPrimary" = EXCLUDED."isPrimary",
      metadata = COALESCE(EXCLUDED.metadata, "userSleeperAccounts".metadata),
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listUserSleeperAccounts(userOpenId: string): Promise<UserSleeperAccountRecord[]> {
  const normalizedUserOpenId = requiredTrimmed(userOpenId, "userOpenId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list user Sleeper accounts: database not available");
    return [];
  }

  const result = await sql`
    SELECT
      "sleeperUserId",
      "sleeperUsername",
      "displayName",
      avatar,
      "isPrimary",
      "updatedAt"
    FROM "userSleeperAccounts"
    WHERE "userOpenId" = ${normalizedUserOpenId}
    ORDER BY "isPrimary" DESC, "updatedAt" DESC
  ` as Record<string, any>[];

  return result.map((row) => ({
    sleeperUserId: String(row.sleeperUserId || ""),
    sleeperUsername: String(row.sleeperUsername || ""),
    displayName: row.displayName ? String(row.displayName) : null,
    avatar: row.avatar ? String(row.avatar) : null,
    isPrimary: parseBooleanFlag(row.isPrimary),
    updatedAt: normalizeDateForDb(row.updatedAt),
  }));
}

export async function deleteUserSleeperAccount(input: {
  userOpenId: string;
  sleeperUserId: string;
}): Promise<boolean> {
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const sleeperUserId = requiredTrimmed(input.sleeperUserId, "sleeperUserId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot delete user Sleeper account: database not available");
    return false;
  }

  await sql`
    DELETE FROM "userSleeperAccounts"
    WHERE "userOpenId" = ${userOpenId}
      AND "sleeperUserId" = ${sleeperUserId}
  `;

  return true;
}

export async function upsertUserFavoriteLeague(input: UserFavoriteLeagueInput): Promise<boolean> {
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const leagueId = requiredTrimmed(input.leagueId, "leagueId");
  const platform = optionalTrimmed(input.platform) ?? "sleeper";
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert user favorite league: database not available");
    return false;
  }

  await sql`
    INSERT INTO "userFavoriteLeagues" (
      "userOpenId",
      "leagueId",
      "leagueName",
      platform,
      "sleeperUserId",
      metadata,
      "updatedAt"
    )
    VALUES (
      ${userOpenId},
      ${leagueId},
      ${optionalTrimmed(input.leagueName)},
      ${platform},
      ${optionalTrimmed(input.sleeperUserId)},
      ${toAccountMetadata(input.metadata)},
      NOW()
    )
    ON CONFLICT ("userOpenId", "leagueId") DO UPDATE SET
      "leagueName" = COALESCE(EXCLUDED."leagueName", "userFavoriteLeagues"."leagueName"),
      platform = EXCLUDED.platform,
      "sleeperUserId" = COALESCE(EXCLUDED."sleeperUserId", "userFavoriteLeagues"."sleeperUserId"),
      metadata = COALESCE(EXCLUDED.metadata, "userFavoriteLeagues".metadata),
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listUserFavoriteLeagues(userOpenId: string): Promise<UserFavoriteLeagueRecord[]> {
  const normalizedUserOpenId = requiredTrimmed(userOpenId, "userOpenId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list user favorite leagues: database not available");
    return [];
  }

  const result = await sql`
    SELECT
      "leagueId",
      "leagueName",
      platform,
      "sleeperUserId",
      "updatedAt"
    FROM "userFavoriteLeagues"
    WHERE "userOpenId" = ${normalizedUserOpenId}
    ORDER BY "updatedAt" DESC
  ` as Record<string, any>[];

  return result.map((row) => ({
    leagueId: String(row.leagueId || ""),
    leagueName: row.leagueName ? String(row.leagueName) : null,
    platform: String(row.platform || "sleeper"),
    sleeperUserId: row.sleeperUserId ? String(row.sleeperUserId) : null,
    updatedAt: normalizeDateForDb(row.updatedAt),
  }));
}

export async function deleteUserFavoriteLeague(input: {
  userOpenId: string;
  leagueId: string;
}): Promise<boolean> {
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const leagueId = requiredTrimmed(input.leagueId, "leagueId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot delete user favorite league: database not available");
    return false;
  }

  await sql`
    DELETE FROM "userFavoriteLeagues"
    WHERE "userOpenId" = ${userOpenId}
      AND "leagueId" = ${leagueId}
  `;

  return true;
}

export async function recordUserRecentReport(input: UserRecentReportInput): Promise<boolean> {
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const leagueId = requiredTrimmed(input.leagueId, "leagueId");
  const platform = optionalTrimmed(input.platform) ?? "sleeper";
  const lastViewedAt = normalizeDateForDb(input.lastViewedAt) ?? new Date();
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot record user recent report: database not available");
    return false;
  }

  await sql`
    INSERT INTO "userRecentReports" (
      "userOpenId",
      "leagueId",
      "leagueName",
      "sleeperUsername",
      "sleeperUserId",
      platform,
      metadata,
      "lastViewedAt",
      "updatedAt"
    )
    VALUES (
      ${userOpenId},
      ${leagueId},
      ${optionalTrimmed(input.leagueName)},
      ${optionalTrimmed(input.sleeperUsername)?.toLowerCase() ?? null},
      ${optionalTrimmed(input.sleeperUserId)},
      ${platform},
      ${toAccountMetadata(input.metadata)},
      ${lastViewedAt},
      NOW()
    )
    ON CONFLICT ("userOpenId", "leagueId") DO UPDATE SET
      "leagueName" = COALESCE(EXCLUDED."leagueName", "userRecentReports"."leagueName"),
      "sleeperUsername" = COALESCE(EXCLUDED."sleeperUsername", "userRecentReports"."sleeperUsername"),
      "sleeperUserId" = COALESCE(EXCLUDED."sleeperUserId", "userRecentReports"."sleeperUserId"),
      platform = EXCLUDED.platform,
      metadata = COALESCE(EXCLUDED.metadata, "userRecentReports".metadata),
      "lastViewedAt" = EXCLUDED."lastViewedAt",
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listUserRecentReports(userOpenId: string, limit = 20): Promise<UserRecentReportRecord[]> {
  const normalizedUserOpenId = requiredTrimmed(userOpenId, "userOpenId");
  const boundedLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 20)));
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list user recent reports: database not available");
    return [];
  }

  const result = await sql`
    SELECT
      "leagueId",
      "leagueName",
      "sleeperUsername",
      "sleeperUserId",
      platform,
      "lastViewedAt"
    FROM "userRecentReports"
    WHERE "userOpenId" = ${normalizedUserOpenId}
    ORDER BY "lastViewedAt" DESC
    LIMIT ${boundedLimit}
  ` as Record<string, any>[];

  return result.map((row) => ({
    leagueId: String(row.leagueId || ""),
    leagueName: row.leagueName ? String(row.leagueName) : null,
    sleeperUsername: row.sleeperUsername ? String(row.sleeperUsername) : null,
    sleeperUserId: row.sleeperUserId ? String(row.sleeperUserId) : null,
    platform: String(row.platform || "sleeper"),
    lastViewedAt: normalizeDateForDb(row.lastViewedAt),
  }));
}

export async function upsertUserNotificationPreferences(input: UserNotificationPreferencesInput): Promise<boolean> {
  const userOpenId = requiredTrimmed(input.userOpenId, "userOpenId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert user notification preferences: database not available");
    return false;
  }

  await sql`
    INSERT INTO "userNotificationPreferences" (
      "userOpenId",
      "billingEmails",
      "productEmails",
      "reportAlerts",
      "anomalyAlerts",
      "weeklyDigest",
      metadata,
      "updatedAt"
    )
    VALUES (
      ${userOpenId},
      ${normalizeBooleanFlag(input.billingEmails, true)},
      ${normalizeBooleanFlag(input.productEmails, true)},
      ${normalizeBooleanFlag(input.reportAlerts, false)},
      ${normalizeBooleanFlag(input.anomalyAlerts, false)},
      ${normalizeBooleanFlag(input.weeklyDigest, false)},
      ${toAccountMetadata(input.metadata)},
      NOW()
    )
    ON CONFLICT ("userOpenId") DO UPDATE SET
      "billingEmails" = EXCLUDED."billingEmails",
      "productEmails" = EXCLUDED."productEmails",
      "reportAlerts" = EXCLUDED."reportAlerts",
      "anomalyAlerts" = EXCLUDED."anomalyAlerts",
      "weeklyDigest" = EXCLUDED."weeklyDigest",
      metadata = COALESCE(EXCLUDED.metadata, "userNotificationPreferences".metadata),
      "updatedAt" = NOW()
  `;

  return true;
}

export async function getUserNotificationPreferences(userOpenId: string): Promise<UserNotificationPreferencesRecord> {
  const normalizedUserOpenId = requiredTrimmed(userOpenId, "userOpenId");
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot get user notification preferences: database not available");
    return {
      billingEmails: true,
      productEmails: true,
      reportAlerts: false,
      anomalyAlerts: false,
      weeklyDigest: false,
      updatedAt: null,
    };
  }

  const result = await sql`
    SELECT
      "billingEmails",
      "productEmails",
      "reportAlerts",
      "anomalyAlerts",
      "weeklyDigest",
      "updatedAt"
    FROM "userNotificationPreferences"
    WHERE "userOpenId" = ${normalizedUserOpenId}
    LIMIT 1
  ` as Record<string, any>[];

  const row = result[0];
  if (!row) {
    return {
      billingEmails: true,
      productEmails: true,
      reportAlerts: false,
      anomalyAlerts: false,
      weeklyDigest: false,
      updatedAt: null,
    };
  }

  return {
    billingEmails: parseBooleanFlag(row.billingEmails, true),
    productEmails: parseBooleanFlag(row.productEmails, true),
    reportAlerts: parseBooleanFlag(row.reportAlerts),
    anomalyAlerts: parseBooleanFlag(row.anomalyAlerts),
    weeklyDigest: parseBooleanFlag(row.weeklyDigest),
    updatedAt: normalizeDateForDb(row.updatedAt),
  };
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

export async function insertPlayerValueSnapshots(rows: PlayerValueSnapshotInsert[]) {
  const sql = await getDb();
  if (!sql || rows.length === 0) return false;

  const chunkSize = 2000;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await sql`
      INSERT INTO "playerValueSnapshots" (
        "snapshotDate",
        "profileKey",
        "playerKey",
        name,
        value,
        rank,
        "sourceCount",
        sources,
        "sourceValues"
      )
      SELECT
        x."snapshotDate",
        x."profileKey",
        x."playerKey",
        x.name,
        x.value,
        x.rank,
        x."sourceCount",
        x.sources,
        x."sourceValues"
      FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS x(
        "snapshotDate" timestamptz,
        "profileKey" text,
        "playerKey" text,
        name text,
        value integer,
        rank text,
        "sourceCount" integer,
        sources jsonb,
        "sourceValues" jsonb
      )
      ON CONFLICT ("snapshotDate", "profileKey", "playerKey") DO UPDATE SET
        name = EXCLUDED.name,
        value = EXCLUDED.value,
        rank = EXCLUDED.rank,
        "sourceCount" = EXCLUDED."sourceCount",
        sources = EXCLUDED.sources,
        "sourceValues" = EXCLUDED."sourceValues"
    `;
  }

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

export async function listKtcSnapshotPayloadsSince(targetDate: Date): Promise<StoredKtcSnapshotPayload[]> {
  const sql = await getDb();
  if (!sql) return [];

  const result = await sql`
    SELECT "snapshotDate", "ktcData"
    FROM "ktcSnapshots"
    WHERE "snapshotDate" >= ${targetDate}
    ORDER BY "snapshotDate" ASC
  ` as Array<Record<string, any>>;

  return result
    .map((row) => ({
      snapshotDate: row.snapshotDate instanceof Date ? row.snapshotDate : new Date(row.snapshotDate),
      ktcData: String(row.ktcData || ''),
    }))
    .filter((row) => Number.isFinite(row.snapshotDate.getTime()) && row.ktcData.length > 0);
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

export async function findPlayerValueSnapshotsSince(input: {
  profileKey: string;
  playerKeys: string[];
  targetDate: Date;
}): Promise<StoredPlayerValueSnapshot[]> {
  const sql = await getDb();
  if (!sql) return [];

  const playerKeys = Array.from(new Set(input.playerKeys.map((key) => String(key || '').trim()).filter(Boolean)));
  if (!playerKeys.length) return [];

  const result = await sql`
    WITH requested_players AS (
      SELECT value::text AS "playerKey"
      FROM jsonb_array_elements_text(${JSON.stringify(playerKeys)}::jsonb)
    ),
    daily_values AS (
      SELECT DISTINCT ON (
        pvs."playerKey",
        to_char(pvs."snapshotDate" AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD')
      )
        to_char(pvs."snapshotDate" AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD') AS "dateKey",
        pvs."snapshotDate",
        pvs."profileKey",
        pvs."playerKey",
        pvs.name,
        pvs.value,
        pvs.rank,
        pvs."sourceCount",
        pvs.sources,
        pvs."sourceValues"
      FROM "playerValueSnapshots" pvs
      INNER JOIN requested_players rp
        ON rp."playerKey" = pvs."playerKey"
      WHERE pvs."profileKey" = ${input.profileKey}
        AND pvs."snapshotDate" >= ${input.targetDate}
      ORDER BY
        pvs."playerKey",
        to_char(pvs."snapshotDate" AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD'),
        pvs."snapshotDate" DESC
    )
    SELECT *
    FROM daily_values
    ORDER BY "dateKey" ASC, "playerKey" ASC
  ` as Array<Record<string, any>>;

  const parseJsonColumn = <T>(value: unknown, fallback: T): T => {
    if (typeof value !== "string") return (value as T) || fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };

  return result
    .map((row) => ({
      snapshotDate: row.snapshotDate instanceof Date
        ? row.snapshotDate.toISOString()
        : new Date(row.snapshotDate).toISOString(),
      dateKey: String(row.dateKey || ''),
      profileKey: String(row.profileKey || ''),
      playerKey: String(row.playerKey || ''),
      name: String(row.name || ''),
      value: Number(row.value),
      rank: row.rank ?? null,
      sourceCount: Number(row.sourceCount || 0),
      sources: parseJsonColumn<string[]>(row.sources, []),
      sourceValues: parseJsonColumn<Record<string, number | null>>(row.sourceValues, {}),
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.dateKey) && Number.isFinite(row.value) && row.value > 0);
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

export async function upsertProviderDataSnapshot(input: {
  sourceKey: string;
  snapshotKey: string;
  payload: string;
}) {
  const sql = await getDb();
  if (!sql) return false;

  await sql`
    INSERT INTO "providerDataSnapshots" ("sourceKey", "snapshotKey", payload)
    VALUES (${input.sourceKey}, ${input.snapshotKey}, ${serializeTextPayloadForStorage(input.payload)})
    ON CONFLICT ("sourceKey", "snapshotKey") DO UPDATE SET
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()
  `;

  return true;
}

export async function findLatestProviderDataSnapshot(sourceKey: string) {
  const sql = await getDb();
  if (!sql) return null;

  const result = await sql`
    SELECT "snapshotKey", payload, "updatedAt"
    FROM "providerDataSnapshots"
    WHERE "sourceKey" = ${sourceKey}
    ORDER BY "snapshotKey" DESC
    LIMIT 1
  ` as Array<{ snapshotKey?: string | null; payload?: string | null; updatedAt?: Date | string | null }>;

  const row = result[0];
  if (!row?.payload) return null;
  return {
    snapshotKey: String(row.snapshotKey || ''),
    payload: parseTextPayloadFromStorage(String(row.payload)),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
}

export async function findProviderDataSnapshot(sourceKey: string, snapshotKey: string) {
  const sql = await getDb();
  if (!sql) return null;

  const result = await sql`
    SELECT "snapshotKey", payload, "updatedAt"
    FROM "providerDataSnapshots"
    WHERE "sourceKey" = ${sourceKey}
      AND "snapshotKey" = ${snapshotKey}
    LIMIT 1
  ` as Array<{ snapshotKey?: string | null; payload?: string | null; updatedAt?: Date | string | null }>;

  const row = result[0];
  if (!row?.payload) return null;
  return {
    snapshotKey: String(row.snapshotKey || ''),
    payload: parseTextPayloadFromStorage(String(row.payload)),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
}

export async function findProviderDataSnapshotOnOrBefore(sourceKey: string, snapshotKey: string) {
  const sql = await getDb();
  if (!sql) return null;

  const result = await sql`
    SELECT "snapshotKey", payload, "updatedAt"
    FROM "providerDataSnapshots"
    WHERE "sourceKey" = ${sourceKey}
      AND "snapshotKey" <= ${snapshotKey}
    ORDER BY "snapshotKey" DESC
    LIMIT 1
  ` as Array<{ snapshotKey?: string | null; payload?: string | null; updatedAt?: Date | string | null }>;

  const row = result[0];
  if (!row?.payload) return null;
  return {
    snapshotKey: String(row.snapshotKey || ''),
    payload: parseTextPayloadFromStorage(String(row.payload)),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
}

export async function listLatestSnapshotMetadata(): Promise<StoredSnapshotMetadata[]> {
  const sql = await getDb();
  if (!sql) return [];

  const result = await sql`
    WITH latest_ktc AS (
      SELECT
        'ktc-blended-values-v1'::text AS "sourceKey",
        'Blended value snapshot'::text AS source,
        to_char("snapshotDate" AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD') AS "snapshotKey",
        "createdAt" AS "updatedAt",
        octet_length(COALESCE("ktcData", '')) AS "payloadSizeBytes",
        'ktcSnapshots'::text AS "tableName"
      FROM "ktcSnapshots"
      ORDER BY "snapshotDate" DESC
      LIMIT 1
    ),
    latest_prospects AS (
      SELECT DISTINCT ON (source)
        ('prospect-snapshot:' || source)::text AS "sourceKey",
        ('Prospect snapshot: ' || source)::text AS source,
        "snapshotMonth" AS "snapshotKey",
        "createdAt" AS "updatedAt",
        octet_length(COALESCE("prospectData", '')) AS "payloadSizeBytes",
        'prospectSnapshots'::text AS "tableName"
      FROM "prospectSnapshots"
      ORDER BY source, "snapshotMonth" DESC
    ),
    latest_redraft AS (
      SELECT DISTINCT ON (season)
        ('redraft-source-snapshot:' || season)::text AS "sourceKey",
        ('Redraft source snapshot: ' || season)::text AS source,
        "snapshotKey",
        "updatedAt",
        octet_length(COALESCE(payload, '')) AS "payloadSizeBytes",
        'redraftSourceSnapshots'::text AS "tableName"
      FROM "redraftSourceSnapshots"
      ORDER BY season, "snapshotKey" DESC
    ),
    latest_devy AS (
      SELECT DISTINCT ON ("profileKey")
        ('devy-source-snapshot:' || "profileKey")::text AS "sourceKey",
        ('Devy source snapshot: ' || "profileKey")::text AS source,
        "snapshotKey",
        "updatedAt",
        octet_length(COALESCE(payload, '')) AS "payloadSizeBytes",
        'devySourceSnapshots'::text AS "tableName"
      FROM "devySourceSnapshots"
      ORDER BY "profileKey", "snapshotKey" DESC
    ),
    latest_provider AS (
      SELECT DISTINCT ON ("sourceKey")
        "sourceKey"::text,
        "sourceKey"::text AS source,
        "snapshotKey",
        "updatedAt",
        octet_length(COALESCE(payload, '')) AS "payloadSizeBytes",
        'providerDataSnapshots'::text AS "tableName"
      FROM "providerDataSnapshots"
      ORDER BY "sourceKey", "snapshotKey" DESC
    )
    SELECT * FROM latest_ktc
    UNION ALL SELECT * FROM latest_prospects
    UNION ALL SELECT * FROM latest_redraft
    UNION ALL SELECT * FROM latest_devy
    UNION ALL SELECT * FROM latest_provider
    ORDER BY "sourceKey" ASC
  ` as Array<{
    sourceKey?: string | null;
    source?: string | null;
    snapshotKey?: string | null;
    updatedAt?: Date | string | null;
    payloadSizeBytes?: number | string | null;
    tableName?: string | null;
  }>;

  return result.map((row) => ({
    sourceKey: String(row.sourceKey || 'unknown'),
    source: String(row.source || row.sourceKey || 'Unknown source'),
    snapshotKey: row.snapshotKey ? String(row.snapshotKey) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    payloadSizeBytes: row.payloadSizeBytes === null || row.payloadSizeBytes === undefined
      ? null
      : Number(row.payloadSizeBytes),
    tableName: String(row.tableName || 'unknown'),
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
    return parseLeagueReportCachePayloadFromStorage(payload);
  } catch (error) {
    console.warn("[Database] Failed to parse league report cache:", error);
    return null;
  }
}

export async function findLeagueReportCacheMetadata(cacheKey: string, maxAgeMs: number): Promise<LeagueReportCacheMetadata | null> {
  const sql = await getDb();
  if (!sql) return null;

  const freshAfter = new Date(Date.now() - maxAgeMs);
  const result = await sql`
    SELECT
      "cacheKey",
      "leagueId",
      "viewerUserId",
      "updatedAt",
      OCTET_LENGTH(payload) AS payload_bytes
    FROM "leagueReportCache"
    WHERE "cacheKey" = ${cacheKey}
      AND "updatedAt" >= ${freshAfter}
    LIMIT 1
  ` as Array<{
    cacheKey?: string | null;
    leagueId?: string | null;
    viewerUserId?: string | null;
    updatedAt?: Date | string | null;
    payload_bytes?: number | string | null;
  }>;

  const row = result[0];
  if (!row?.cacheKey || !row.leagueId) return null;

  return {
    cacheKey: String(row.cacheKey),
    leagueId: String(row.leagueId),
    viewerUserId: row.viewerUserId ? String(row.viewerUserId) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
    payloadSizeBytes: Number(row.payload_bytes || 0),
  };
}

export async function upsertLeagueReportCache(input: {
  cacheKey: string;
  leagueId: string;
  viewerUserId?: string | null;
  payload: unknown;
}): Promise<void> {
  const sql = await getDb();
  if (!sql) return;

  const payload = serializeLeagueReportCachePayloadForStorage(input.payload);
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
        payload = parseLeagueReportCachePayloadFromStorage(String(row.payload || 'null'));
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

export async function listLeagueReportCacheMetadata(limit = 100): Promise<Array<{
  cacheKey: string;
  leagueId: string;
  viewerUserId: string | null;
  updatedAt: Date;
  payloadSizeBytes: number;
}>> {
  const sql = await getDb();
  if (!sql) return [];

  const boundedLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const result = await sql`
    SELECT
      "cacheKey",
      "leagueId",
      "viewerUserId",
      "updatedAt",
      OCTET_LENGTH(payload) AS payload_bytes
    FROM "leagueReportCache"
    ORDER BY "updatedAt" DESC
    LIMIT ${boundedLimit}
  ` as Array<{
    cacheKey?: string | null;
    leagueId?: string | null;
    viewerUserId?: string | null;
    updatedAt?: Date | string | null;
    payload_bytes?: number | string | null;
  }>;

  return result
    .filter((row) => row.cacheKey && row.leagueId)
    .map((row) => ({
      cacheKey: String(row.cacheKey),
      leagueId: String(row.leagueId),
      viewerUserId: row.viewerUserId ? String(row.viewerUserId) : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      payloadSizeBytes: Number(row.payload_bytes || 0),
    }));
}

export async function findLeagueReportCachePayload(cacheKey: string): Promise<unknown | null> {
  const sql = await getDb();
  if (!sql) return null;

  const result = await sql`
    SELECT payload
    FROM "leagueReportCache"
    WHERE "cacheKey" = ${cacheKey}
    LIMIT 1
  ` as Array<{ payload?: string | null }>;

  const payload = result[0]?.payload;
  if (!payload) return null;

  try {
    return parseLeagueReportCachePayloadFromStorage(payload);
  } catch (error) {
    console.warn('[Database] Failed to parse league report cache payload by key:', error);
    return null;
  }
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
    const rawStatus = String(row.status || "");
    const allowedStatuses = new Set<ActionPlanStatus>(["saved", "submitted", "copied", "opened", "won", "lost", "acted", "blocked", "stale"]);
    const status: ActionPlanStatus = rawStatus === "tracked"
      ? "saved"
      : allowedStatuses.has(rawStatus as ActionPlanStatus)
        ? rawStatus as ActionPlanStatus
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

function normalizeAiPredictionOutcomeStatus(value: unknown): AIPredictionOutcome["status"] {
  return ["hit", "miss", "push", "pending", "blocked"].includes(String(value))
    ? String(value) as AIPredictionOutcome["status"]
    : "pending";
}

function normalizeAiPredictionEventRow(row: any): AiPredictionEventRecord | null {
  try {
    const parsed = row.payload ? JSON.parse(row.payload) as AIPredictionEvent : null;
    if (!parsed) return null;
    const resolvedAt = row.resolvedAt ? new Date(row.resolvedAt).toISOString() : parsed.outcome?.resolvedAt ?? null;
    const outcome: AIPredictionOutcome = {
      ...(parsed.outcome || { status: "pending" }),
      status: normalizeAiPredictionOutcomeStatus(row.outcomeStatus ?? parsed.outcome?.status),
      actualValue: row.outcomeValue === null || row.outcomeValue === undefined
        ? parsed.outcome?.actualValue ?? null
        : Number(row.outcomeValue),
      baselineValue: row.baselineValue === null || row.baselineValue === undefined
        ? parsed.outcome?.baselineValue ?? null
        : Number(row.baselineValue),
      resolvedAt,
    };
    return {
      ...parsed,
      eventId: String(row.eventId || parsed.eventId),
      predictionKey: String(row.predictionKey || parsed.predictionKey),
      leagueId: row.leagueId ?? parsed.leagueId ?? null,
      surface: row.surface || parsed.surface,
      action: row.action || parsed.action,
      decision: row.decision || parsed.decision,
      entityType: row.entityType || parsed.entityType,
      entityId: row.entityId ?? parsed.entityId ?? null,
      entityName: row.entityName ?? parsed.entityName ?? null,
      manager: row.manager ?? parsed.manager ?? null,
      label: row.label || parsed.label,
      finalScore: Number(row.finalScore ?? parsed.finalScore ?? 0),
      confidenceCap: Number(row.confidenceCap ?? parsed.confidenceCap ?? 100),
      createdAt: new Date(row.createdAt || parsed.createdAt).toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      userKey: row.userKey ?? null,
      outcome,
    };
  } catch (error) {
    console.warn("[Database] Failed to parse AI prediction event:", error);
    return null;
  }
}

export async function upsertAiPredictionEvent(input: {
  userKey?: string | null;
  event: AIPredictionEvent;
}): Promise<boolean> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert AI prediction event: database not available");
    return false;
  }

  const outcome = input.event.outcome || { status: "pending" as const };
  await sql`
    INSERT INTO "aiPredictionEvents" (
      "eventId",
      "predictionKey",
      "userKey",
      "leagueId",
      surface,
      action,
      decision,
      "entityType",
      "entityId",
      "entityName",
      manager,
      label,
      "finalScore",
      "confidenceCap",
      "outcomeStatus",
      "outcomeValue",
      "baselineValue",
      "resolvedAt",
      payload,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${input.event.eventId},
      ${input.event.predictionKey},
      ${input.userKey ?? null},
      ${input.event.leagueId ?? null},
      ${input.event.surface},
      ${input.event.action},
      ${input.event.decision},
      ${input.event.entityType},
      ${input.event.entityId ?? null},
      ${input.event.entityName ?? null},
      ${input.event.manager ?? null},
      ${input.event.label},
      ${input.event.finalScore},
      ${input.event.confidenceCap},
      ${outcome.status},
      ${outcome.actualValue ?? null},
      ${outcome.baselineValue ?? null},
      ${outcome.resolvedAt ? new Date(outcome.resolvedAt) : null},
      ${JSON.stringify(input.event)},
      ${new Date(input.event.createdAt || Date.now())},
      NOW()
    )
    ON CONFLICT ("eventId") DO UPDATE SET
      "predictionKey" = EXCLUDED."predictionKey",
      "userKey" = EXCLUDED."userKey",
      "leagueId" = EXCLUDED."leagueId",
      surface = EXCLUDED.surface,
      action = EXCLUDED.action,
      decision = EXCLUDED.decision,
      "entityType" = EXCLUDED."entityType",
      "entityId" = EXCLUDED."entityId",
      "entityName" = EXCLUDED."entityName",
      manager = EXCLUDED.manager,
      label = EXCLUDED.label,
      "finalScore" = EXCLUDED."finalScore",
      "confidenceCap" = EXCLUDED."confidenceCap",
      "outcomeStatus" = EXCLUDED."outcomeStatus",
      "outcomeValue" = EXCLUDED."outcomeValue",
      "baselineValue" = EXCLUDED."baselineValue",
      "resolvedAt" = EXCLUDED."resolvedAt",
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()
  `;

  return true;
}

export async function listAiPredictionEvents(input: {
  userKey?: string | null;
  leagueId?: string | null;
  limit?: number;
} = {}): Promise<AiPredictionEventRecord[]> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list AI prediction events: database not available");
    return [];
  }

  const limit = Math.max(1, Math.min(Number(input.limit) || 200, 1000));
  const result = input.userKey && input.leagueId
    ? await sql`
        SELECT
          "eventId",
          "predictionKey",
          "userKey",
          "leagueId",
          surface,
          action,
          decision,
          "entityType",
          "entityId",
          "entityName",
          manager,
          label,
          "finalScore",
          "confidenceCap",
          "outcomeStatus",
          "outcomeValue",
          "baselineValue",
          "resolvedAt",
          payload,
          "createdAt",
          "updatedAt"
        FROM "aiPredictionEvents"
        WHERE "userKey" = ${input.userKey} AND "leagueId" = ${input.leagueId}
        ORDER BY "updatedAt" DESC
        LIMIT ${limit}
      `
    : input.userKey
      ? await sql`
          SELECT
            "eventId",
            "predictionKey",
            "userKey",
            "leagueId",
            surface,
            action,
            decision,
            "entityType",
            "entityId",
            "entityName",
            manager,
            label,
            "finalScore",
            "confidenceCap",
            "outcomeStatus",
            "outcomeValue",
            "baselineValue",
            "resolvedAt",
            payload,
            "createdAt",
            "updatedAt"
          FROM "aiPredictionEvents"
          WHERE "userKey" = ${input.userKey}
          ORDER BY "updatedAt" DESC
          LIMIT ${limit}
        `
      : input.leagueId
        ? await sql`
            SELECT
              "eventId",
              "predictionKey",
              "userKey",
              "leagueId",
              surface,
              action,
              decision,
              "entityType",
              "entityId",
              "entityName",
              manager,
              label,
              "finalScore",
              "confidenceCap",
              "outcomeStatus",
              "outcomeValue",
              "baselineValue",
              "resolvedAt",
              payload,
              "createdAt",
              "updatedAt"
            FROM "aiPredictionEvents"
            WHERE "leagueId" = ${input.leagueId}
            ORDER BY "updatedAt" DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT
              "eventId",
              "predictionKey",
              "userKey",
              "leagueId",
              surface,
              action,
              decision,
              "entityType",
              "entityId",
              "entityName",
              manager,
              label,
              "finalScore",
              "confidenceCap",
              "outcomeStatus",
              "outcomeValue",
              "baselineValue",
              "resolvedAt",
              payload,
              "createdAt",
              "updatedAt"
            FROM "aiPredictionEvents"
            ORDER BY "updatedAt" DESC
            LIMIT ${limit}
          `;

  return (result as Record<string, any>[])
    .map(normalizeAiPredictionEventRow)
    .filter((event): event is AiPredictionEventRecord => Boolean(event));
}

export async function listPendingAiPredictionEvents(input: {
  leagueId?: string | null;
  limit?: number;
} = {}): Promise<AiPredictionEventRecord[]> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot list pending AI prediction events: database not available");
    return [];
  }

  const limit = Math.max(1, Math.min(Number(input.limit) || 200, 1000));
  const result = input.leagueId
    ? await sql`
        SELECT
          "eventId",
          "predictionKey",
          "userKey",
          "leagueId",
          surface,
          action,
          decision,
          "entityType",
          "entityId",
          "entityName",
          manager,
          label,
          "finalScore",
          "confidenceCap",
          "outcomeStatus",
          "outcomeValue",
          "baselineValue",
          "resolvedAt",
          payload,
          "createdAt",
          "updatedAt"
        FROM "aiPredictionEvents"
        WHERE "outcomeStatus" = 'pending'
          AND "leagueId" = ${input.leagueId}
        ORDER BY "updatedAt" ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          "eventId",
          "predictionKey",
          "userKey",
          "leagueId",
          surface,
          action,
          decision,
          "entityType",
          "entityId",
          "entityName",
          manager,
          label,
          "finalScore",
          "confidenceCap",
          "outcomeStatus",
          "outcomeValue",
          "baselineValue",
          "resolvedAt",
          payload,
          "createdAt",
          "updatedAt"
        FROM "aiPredictionEvents"
        WHERE "outcomeStatus" = 'pending'
        ORDER BY "updatedAt" ASC
        LIMIT ${limit}
      `;

  return (result as Record<string, any>[])
    .map(normalizeAiPredictionEventRow)
    .filter((event): event is AiPredictionEventRecord => Boolean(event));
}

export async function updateAiPredictionOutcome(input: {
  eventId: string;
  userKey?: string | null;
  outcome: AIPredictionOutcome;
}): Promise<boolean> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot update AI prediction outcome: database not available");
    return false;
  }

  const existing = input.userKey
    ? await sql`
        SELECT payload
        FROM "aiPredictionEvents"
        WHERE "eventId" = ${input.eventId}
          AND "userKey" = ${input.userKey}
        LIMIT 1
      `
    : await sql`
        SELECT payload
        FROM "aiPredictionEvents"
        WHERE "eventId" = ${input.eventId}
        LIMIT 1
      `;
  const existingPayload = (existing as Record<string, any>[])[0]?.payload;
  if (!existingPayload) return false;

  let nextPayload: string;
  try {
    const parsed = JSON.parse(existingPayload) as AIPredictionEvent;
    nextPayload = JSON.stringify({
      ...parsed,
      outcome: {
        ...(parsed.outcome || { status: "pending" }),
        ...input.outcome,
      },
    });
  } catch {
    nextPayload = existingPayload;
  }

  if (input.userKey) {
    await sql`
      UPDATE "aiPredictionEvents"
      SET
        "outcomeStatus" = ${input.outcome.status},
        "outcomeValue" = ${input.outcome.actualValue ?? null},
        "baselineValue" = ${input.outcome.baselineValue ?? null},
        "resolvedAt" = ${input.outcome.resolvedAt ? new Date(input.outcome.resolvedAt) : null},
        payload = ${nextPayload},
        "updatedAt" = NOW()
      WHERE "eventId" = ${input.eventId}
        AND "userKey" = ${input.userKey}
    `;
  } else {
    await sql`
      UPDATE "aiPredictionEvents"
      SET
        "outcomeStatus" = ${input.outcome.status},
        "outcomeValue" = ${input.outcome.actualValue ?? null},
        "baselineValue" = ${input.outcome.baselineValue ?? null},
        "resolvedAt" = ${input.outcome.resolvedAt ? new Date(input.outcome.resolvedAt) : null},
        payload = ${nextPayload},
        "updatedAt" = NOW()
      WHERE "eventId" = ${input.eventId}
    `;
  }

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

type SleeperHiddenLeagueSnapshotPayload = {
  tradeProposalSignals: TradeProposalSignal[];
  waiverSignals: SleeperWaiverClaimSignal[];
  transactionCount: number;
  tradeCount: number;
  waiverCount: number;
};

type StoredSleeperHiddenLeagueSnapshot = SleeperHiddenLeagueSnapshot & SleeperHiddenLeagueSnapshotPayload;

function normalizeSleeperHiddenLeagueSnapshotRow(row: any): StoredSleeperHiddenLeagueSnapshot | null {
  try {
    const payload = row?.payload ? JSON.parse(String(row.payload)) as Partial<SleeperHiddenLeagueSnapshotPayload> : null;
    if (!payload) return null;

    return {
      sharedBy: row.sharedBy ?? null,
      sharedAt: row.sharedAt ? new Date(row.sharedAt).getTime() : Date.now(),
      transactionCount: Number(payload.transactionCount || 0),
      tradeCount: Number(payload.tradeCount || 0),
      waiverCount: Number(payload.waiverCount || 0),
      tradeProposalSignals: Array.isArray(payload.tradeProposalSignals) ? payload.tradeProposalSignals as TradeProposalSignal[] : [],
      waiverSignals: Array.isArray(payload.waiverSignals) ? payload.waiverSignals as SleeperWaiverClaimSignal[] : [],
    };
  } catch (error) {
    console.warn("[Database] Failed to parse hidden Sleeper league snapshot:", error);
    return null;
  }
}

export async function upsertSleeperHiddenLeagueSnapshot(input: {
  leagueId: string;
  sharedBy?: string | null;
  sharedAt?: number | Date | null;
  snapshot: SleeperHiddenLeagueSnapshotPayload;
}): Promise<boolean> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot upsert hidden Sleeper league snapshot: database not available");
    return false;
  }

  const sharedAt = input.sharedAt instanceof Date ? input.sharedAt : new Date(Number(input.sharedAt || Date.now()));

  await sql`
    INSERT INTO "sleeperHiddenLeagueSnapshots" (
      "leagueId",
      "sharedBy",
      "sharedAt",
      payload,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${input.leagueId},
      ${input.sharedBy ?? null},
      ${sharedAt},
      ${JSON.stringify(input.snapshot)},
      NOW(),
      NOW()
    )
    ON CONFLICT ("leagueId") DO UPDATE SET
      "sharedBy" = EXCLUDED."sharedBy",
      "sharedAt" = EXCLUDED."sharedAt",
      payload = EXCLUDED.payload,
      "updatedAt" = NOW()
  `;

  return true;
}

export async function findLatestSleeperHiddenLeagueSnapshot(leagueId: string): Promise<StoredSleeperHiddenLeagueSnapshot | null> {
  const sql = await getDb();
  if (!sql) {
    warnWhenDatabaseUnavailable("[Database] Cannot read hidden Sleeper league snapshot: database not available");
    return null;
  }

  const result = await sql`
    SELECT
      "sharedBy",
      "sharedAt",
      payload
    FROM "sleeperHiddenLeagueSnapshots"
    WHERE "leagueId" = ${leagueId}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  ` as Array<{ sharedBy?: string | null; sharedAt?: Date | string | null; payload?: string | null }>;

  if (!result.length) return null;
  return normalizeSleeperHiddenLeagueSnapshotRow(result[0]);
}
