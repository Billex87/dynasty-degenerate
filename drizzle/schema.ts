import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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
  ktcData: text("ktcData"), // JSON stringified KTC values
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KtcSnapshot = typeof ktcSnapshots.$inferSelect;
export type InsertKtcSnapshot = typeof ktcSnapshots.$inferInsert;