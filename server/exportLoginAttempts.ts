import dotenv from "dotenv";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getLoginAttemptsSince } from "./db";

dotenv.config({ path: ".env.local", override: false });
dotenv.config();

const LOCAL_TIME_ZONE = "America/Vancouver";
const DEFAULT_EXCLUDED_IPS = new Set([
  "205.250.64.165",
  "172.226.164.58",
]);

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const daysArg = args.find((arg) => arg.startsWith("--days="));
  const allTime = args.includes("--all-time");
  const includeOwnIps = args.includes("--include-own-ips");
  const days = daysArg ? Number(daysArg.slice("--days=".length)) : 7;

  return {
    allTime,
    days: Number.isFinite(days) && days > 0 ? days : 7,
    excludedIps: includeOwnIps ? new Set<string>() : DEFAULT_EXCLUDED_IPS,
  };
}

function formatInLocalTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LOCAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}:${value("second")} ${LOCAL_TIME_ZONE}`;
}

async function main() {
  const now = new Date();
  const { allTime, days, excludedIps } = parseArgs();
  const since = allTime ? new Date(0) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const attempts = (await getLoginAttemptsSince(since))
    .filter((attempt) => !attempt.ipAddress || !excludedIps.has(attempt.ipAddress));

  if (attempts.length === 0) {
    console.log(`No login attempts found for ${allTime ? "all time" : `the last ${days} days`} after excluded IP filtering.`);
    return;
  }

  const downloadsDir = path.join(os.homedir(), "Downloads");
  const stamp = now.toISOString().slice(0, 10);
  const rangeLabel = allTime ? "all-time" : `last-${days}-days`;
  const rawFile = path.join(downloadsDir, `dynasty-degens-login-attempts-${rangeLabel}-${stamp}.csv`);
  const summaryFile = path.join(downloadsDir, `dynasty-degens-login-attempts-summary-${rangeLabel}-${stamp}.csv`);

  const rawHeader = [
    "createdAt",
    "eventType",
    "status",
    "ipAddress",
    "username",
    "leagueId",
    "note",
    "userAgent",
  ];
  const rawRows = attempts.map((attempt) => [
    formatInLocalTime(attempt.createdAt),
    attempt.eventType,
    attempt.status,
    attempt.ipAddress,
    attempt.username,
    attempt.leagueId,
    attempt.note,
    attempt.userAgent,
  ]);

  const summaryMap = new Map<string, {
    ipAddress: string;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    usernames: Set<string>;
    leagueIds: Set<string>;
  }>();

  for (const attempt of attempts) {
    const ipKey = attempt.ipAddress || "unknown";
    const existing = summaryMap.get(ipKey) || {
      ipAddress: ipKey,
      count: 0,
      firstSeen: attempt.createdAt,
      lastSeen: attempt.createdAt,
      usernames: new Set<string>(),
      leagueIds: new Set<string>(),
    };
    existing.count += 1;
    if (attempt.createdAt < existing.firstSeen) existing.firstSeen = attempt.createdAt;
    if (attempt.createdAt > existing.lastSeen) existing.lastSeen = attempt.createdAt;
    if (attempt.username) existing.usernames.add(attempt.username);
    if (attempt.leagueId) existing.leagueIds.add(attempt.leagueId);
    summaryMap.set(ipKey, existing);
  }

  const summaryHeader = [
    "ipAddress",
    "attemptCount",
    "firstSeen",
    "lastSeen",
    "usernames",
    "leagueIds",
  ];
  const summaryRows = Array.from(summaryMap.values())
    .sort((a, b) => b.count - a.count || a.ipAddress.localeCompare(b.ipAddress))
    .map((entry) => [
      entry.ipAddress,
      entry.count,
      formatInLocalTime(entry.firstSeen),
      formatInLocalTime(entry.lastSeen),
      Array.from(entry.usernames).sort().join(" | "),
      Array.from(entry.leagueIds).sort().join(" | "),
    ]);

  const toCsv = (header: string[], rows: Array<Array<string | number | null | undefined>>) =>
    [header.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");

  await fs.writeFile(rawFile, toCsv(rawHeader, rawRows), "utf8");
  await fs.writeFile(summaryFile, toCsv(summaryHeader, summaryRows), "utf8");

  console.log(`Wrote ${attempts.length} login attempts to ${rawFile}`);
  console.log(`Wrote ${summaryRows.length} unique IP rows to ${summaryFile}`);
  if (excludedIps.size > 0) {
    console.log(`Excluded IPs: ${Array.from(excludedIps).join(", ")}`);
  }
  console.log(`Timestamps written in ${LOCAL_TIME_ZONE}`);
}

main().catch((error) => {
  console.error("Failed to export login attempts:", error);
  process.exitCode = 1;
});
