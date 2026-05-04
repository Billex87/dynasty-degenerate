import "dotenv/config";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getLoginAttemptsSince } from "./db";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function main() {
  const now = new Date();
  const days = 7;
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const attempts = await getLoginAttemptsSince(since);

  if (attempts.length === 0) {
    console.log("No login attempts found for the last 7 days.");
    return;
  }

  const downloadsDir = path.join(os.homedir(), "Downloads");
  const stamp = now.toISOString().slice(0, 10);
  const rawFile = path.join(downloadsDir, `dynasty-degens-login-attempts-${stamp}.csv`);
  const summaryFile = path.join(downloadsDir, `dynasty-degens-login-attempts-summary-${stamp}.csv`);

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
    attempt.createdAt.toISOString(),
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
    firstSeen: string;
    lastSeen: string;
    usernames: Set<string>;
    leagueIds: Set<string>;
  }>();

  for (const attempt of attempts) {
    const ipKey = attempt.ipAddress || "unknown";
    const existing = summaryMap.get(ipKey) || {
      ipAddress: ipKey,
      count: 0,
      firstSeen: attempt.createdAt.toISOString(),
      lastSeen: attempt.createdAt.toISOString(),
      usernames: new Set<string>(),
      leagueIds: new Set<string>(),
    };
    existing.count += 1;
    if (attempt.createdAt.toISOString() < existing.firstSeen) existing.firstSeen = attempt.createdAt.toISOString();
    if (attempt.createdAt.toISOString() > existing.lastSeen) existing.lastSeen = attempt.createdAt.toISOString();
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
      entry.firstSeen,
      entry.lastSeen,
      [...entry.usernames].sort().join(" | "),
      [...entry.leagueIds].sort().join(" | "),
    ]);

  const toCsv = (header: string[], rows: Array<Array<string | number | null | undefined>>) =>
    [header.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");

  await fs.writeFile(rawFile, toCsv(rawHeader, rawRows), "utf8");
  await fs.writeFile(summaryFile, toCsv(summaryHeader, summaryRows), "utf8");

  console.log(`Wrote ${attempts.length} login attempts to ${rawFile}`);
  console.log(`Wrote ${summaryRows.length} unique IP rows to ${summaryFile}`);
}

main().catch((error) => {
  console.error("Failed to export login attempts:", error);
  process.exitCode = 1;
});
