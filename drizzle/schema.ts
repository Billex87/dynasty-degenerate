import { double, index, int, longtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** First-party auth identifier. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const magicLinkTokens = mysqlTable("magicLinkTokens", {
  id: int("id").autoincrement().primaryKey(),
  tokenId: varchar("tokenId", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  purpose: varchar("purpose", { length: 32 }).default("login").notNull(),
  redirectPath: text("redirectPath"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  emailCreatedAtIndex: index("magicLinkTokens_email_createdAt_idx").on(table.email, table.createdAt),
  expiresAtIndex: index("magicLinkTokens_expiresAt_idx").on(table.expiresAt),
  tokenHashIndex: index("magicLinkTokens_token_hash_idx").on(table.tokenHash),
}));

export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type InsertMagicLinkToken = typeof magicLinkTokens.$inferInsert;

export const billingCustomers = mysqlTable("billingCustomers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  name: text("name"),
  status: varchar("status", { length: 32 }).default("active").notNull(),
  metadata: longtext("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userOpenIdIndex: index("billingCustomers_user_open_id_idx").on(table.userOpenId),
}));

export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type InsertBillingCustomer = typeof billingCustomers.$inferInsert;

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }).notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }).notNull().unique(),
  plan: varchar("plan", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  priceId: varchar("priceId", { length: 128 }),
  productId: varchar("productId", { length: 128 }),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: int("cancelAtPeriodEnd").default(0).notNull(),
  metadata: longtext("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userStatusIndex: index("subscriptions_user_status_idx").on(table.userOpenId, table.status),
  stripeCustomerIndex: index("subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

export const leaguePasses = mysqlTable("leaguePasses", {
  id: int("id").autoincrement().primaryKey(),
  leagueId: varchar("leagueId", { length: 64 }).notNull(),
  purchaserUserId: int("purchaserUserId"),
  purchaserOpenId: varchar("purchaserOpenId", { length: 64 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 128 }),
  status: varchar("status", { length: 32 }).notNull(),
  startsAt: timestamp("startsAt"),
  expiresAt: timestamp("expiresAt"),
  maxManagers: int("maxManagers"),
  metadata: longtext("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  leagueStatusIndex: index("leaguePasses_league_status_idx").on(table.leagueId, table.status),
  purchaserIndex: index("leaguePasses_purchaser_idx").on(table.purchaserOpenId),
  stripeCheckoutIndex: index("leaguePasses_stripe_checkout_idx").on(table.stripeCheckoutSessionId),
}));

export type LeaguePass = typeof leaguePasses.$inferSelect;
export type InsertLeaguePass = typeof leaguePasses.$inferInsert;

export const featureEntitlements = mysqlTable("featureEntitlements", {
  id: int("id").autoincrement().primaryKey(),
  subjectType: varchar("subjectType", { length: 16 }).notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }),
  leagueId: varchar("leagueId", { length: 64 }),
  featureKey: varchar("featureKey", { length: 64 }).notNull(),
  plan: varchar("plan", { length: 32 }),
  source: varchar("source", { length: 32 }).notNull(),
  sourceId: varchar("sourceId", { length: 128 }),
  status: varchar("status", { length: 32 }).notNull(),
  startsAt: timestamp("startsAt"),
  expiresAt: timestamp("expiresAt"),
  metadata: longtext("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userFeatureIndex: index("featureEntitlements_user_feature_idx").on(table.userOpenId, table.featureKey, table.status),
  leagueFeatureIndex: index("featureEntitlements_league_feature_idx").on(table.leagueId, table.featureKey, table.status),
  sourceIndex: index("featureEntitlements_source_idx").on(table.source, table.sourceId),
}));

export type FeatureEntitlement = typeof featureEntitlements.$inferSelect;
export type InsertFeatureEntitlement = typeof featureEntitlements.$inferInsert;

export const usageEvents = mysqlTable("usageEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 128 }).notNull().unique(),
  userOpenId: varchar("userOpenId", { length: 64 }),
  leagueId: varchar("leagueId", { length: 64 }),
  featureKey: varchar("featureKey", { length: 64 }).notNull(),
  usageKey: varchar("usageKey", { length: 64 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  metadata: longtext("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userFeatureIndex: index("usageEvents_user_feature_createdAt_idx").on(table.userOpenId, table.featureKey, table.createdAt),
  leagueFeatureIndex: index("usageEvents_league_feature_createdAt_idx").on(table.leagueId, table.featureKey, table.createdAt),
  usageKeyIndex: index("usageEvents_feature_usage_key_idx").on(table.featureKey, table.usageKey),
}));

export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = typeof usageEvents.$inferInsert;

export const leagueAnalysis = mysqlTable("leagueAnalysis", {
  id: int("id").autoincrement().primaryKey(),
  leagueId: varchar("leagueId", { length: 64 }).notNull().unique(),
  leagueName: text("leagueName"),
  analysisData: text("analysisData"), // JSON stringified analysis
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeagueAnalysis = typeof leagueAnalysis.$inferSelect;
export type InsertLeagueAnalysis = typeof leagueAnalysis.$inferInsert;

export const ktcSnapshots = mysqlTable("ktcSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: timestamp("snapshotDate").notNull(),
  ktcData: longtext("ktcData"), // JSON stringified KTC values
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KtcSnapshot = typeof ktcSnapshots.$inferSelect;
export type InsertKtcSnapshot = typeof ktcSnapshots.$inferInsert;

export const prospectSnapshots = mysqlTable("prospectSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 64 }).notNull(),
  snapshotMonth: varchar("snapshotMonth", { length: 7 }).notNull(),
  prospectData: longtext("prospectData"), // JSON stringified prospect context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sourceMonthUnique: uniqueIndex("prospectSnapshots_source_month_uidx").on(table.source, table.snapshotMonth),
  sourceMonthIndex: index("prospectSnapshots_source_month_idx").on(table.source, table.snapshotMonth),
}));

export type ProspectSnapshot = typeof prospectSnapshots.$inferSelect;
export type InsertProspectSnapshot = typeof prospectSnapshots.$inferInsert;

export const devySourceSnapshots = mysqlTable("devySourceSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotKey: varchar("snapshotKey", { length: 10 }).notNull(),
  profileKey: varchar("profileKey", { length: 64 }).notNull(),
  payload: longtext("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  profileKeyUnique: uniqueIndex("devySourceSnapshots_profile_key_uidx").on(table.profileKey, table.snapshotKey),
  profileKeyIndex: index("devySourceSnapshots_profile_key_idx").on(table.profileKey, table.snapshotKey),
}));

export type DevySourceSnapshot = typeof devySourceSnapshots.$inferSelect;
export type InsertDevySourceSnapshot = typeof devySourceSnapshots.$inferInsert;

export const leagueAiConfidenceSnapshots = mysqlTable("leagueAiConfidenceSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotKey: varchar("snapshotKey", { length: 10 }).notNull(),
  leagueId: text("leagueId").notNull(),
  payload: longtext("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  leagueKeyUnique: uniqueIndex("leagueAiConfidenceSnapshots_league_key_uidx").on(table.leagueId, table.snapshotKey),
  leagueKeyIndex: index("leagueAiConfidenceSnapshots_league_key_idx").on(table.leagueId, table.snapshotKey),
}));

export type LeagueAiConfidenceSnapshot = typeof leagueAiConfidenceSnapshots.$inferSelect;
export type InsertLeagueAiConfidenceSnapshot = typeof leagueAiConfidenceSnapshots.$inferInsert;

export const aiPredictionEvents = mysqlTable("aiPredictionEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: text("eventId").notNull(),
  predictionKey: text("predictionKey").notNull(),
  userKey: text("userKey"),
  leagueId: text("leagueId"),
  surface: varchar("surface", { length: 32 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  decision: varchar("decision", { length: 16 }).notNull(),
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: text("entityId"),
  entityName: text("entityName"),
  manager: text("manager"),
  label: varchar("label", { length: 32 }).notNull(),
  finalScore: int("finalScore").notNull(),
  confidenceCap: int("confidenceCap").default(100).notNull(),
  outcomeStatus: varchar("outcomeStatus", { length: 16 }).default("pending").notNull(),
  outcomeValue: double("outcomeValue"),
  baselineValue: double("baselineValue"),
  resolvedAt: timestamp("resolvedAt"),
  payload: longtext("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  eventUnique: uniqueIndex("aiPredictionEvents_event_uidx").on(table.eventId),
  userLeagueIndex: index("aiPredictionEvents_user_league_updatedAt_idx").on(table.userKey, table.leagueId, table.updatedAt),
  predictionKeyIndex: index("aiPredictionEvents_prediction_key_idx").on(table.predictionKey, table.updatedAt),
  surfaceActionIndex: index("aiPredictionEvents_surface_action_createdAt_idx").on(table.surface, table.action, table.createdAt),
  outcomeStatusIndex: index("aiPredictionEvents_outcome_status_idx").on(table.outcomeStatus, table.updatedAt),
}));

export type AiPredictionEvent = typeof aiPredictionEvents.$inferSelect;
export type InsertAiPredictionEvent = typeof aiPredictionEvents.$inferInsert;

export const sourceHealthEvents = mysqlTable("sourceHealthEvents", {
  id: int("id").autoincrement().primaryKey(),
  job: text("job").notNull(),
  board: varchar("board", { length: 16 }),
  sourceKey: text("sourceKey").notNull(),
  source: text("source").notNull(),
  level: varchar("level", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  rowCount: int("rowCount"),
  message: text("message").notNull(),
  payload: longtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  createdAtIndex: index("sourceHealthEvents_createdAt_idx").on(table.createdAt),
  sourceCreatedAtIndex: index("sourceHealthEvents_source_createdAt_idx").on(table.sourceKey, table.createdAt),
}));

export type SourceHealthEvent = typeof sourceHealthEvents.$inferSelect;
export type InsertSourceHealthEvent = typeof sourceHealthEvents.$inferInsert;

export const actionPlans = mysqlTable("actionPlans", {
  id: int("id").autoincrement().primaryKey(),
  userKey: text("userKey").notNull(),
  planId: text("planId").notNull(),
  kind: varchar("kind", { length: 16 }).notNull(),
  leagueId: text("leagueId"),
  manager: text("manager"),
  playerId: text("playerId"),
  replacementPlayerId: text("replacementPlayerId"),
  title: text("title").notNull(),
  summary: text("summary"),
  status: varchar("status", { length: 16 }).notNull(),
  payload: longtext("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userPlanUnique: uniqueIndex("actionPlans_user_plan_uidx").on(table.userKey, table.planId),
  userLeagueIndex: index("actionPlans_user_league_updatedAt_idx").on(table.userKey, table.leagueId, table.updatedAt),
}));

export type ActionPlan = typeof actionPlans.$inferSelect;
export type InsertActionPlan = typeof actionPlans.$inferInsert;

export const waiverBidHistory = mysqlTable("waiverBidHistory", {
  id: int("id").autoincrement().primaryKey(),
  userKey: text("userKey").notNull(),
  historyId: text("historyId").notNull(),
  leagueId: text("leagueId"),
  manager: text("manager"),
  playerId: text("playerId").notNull(),
  playerName: text("playerName").notNull(),
  position: varchar("position", { length: 8 }).notNull(),
  bidMin: int("bidMin").notNull(),
  bidMax: int("bidMax").notNull(),
  bidLabel: text("bidLabel").notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userHistoryUnique: uniqueIndex("waiverBidHistory_user_history_uidx").on(table.userKey, table.historyId),
  userLeagueIndex: index("waiverBidHistory_user_league_updatedAt_idx").on(table.userKey, table.leagueId, table.updatedAt),
}));

export type WaiverBidHistory = typeof waiverBidHistory.$inferSelect;
export type InsertWaiverBidHistory = typeof waiverBidHistory.$inferInsert;
