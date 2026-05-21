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
