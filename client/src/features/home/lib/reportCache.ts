import { toast } from "sonner";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { sanitizeCachedReport } from "@/lib/reportCacheSanitizer";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import type { ReportData } from "@shared/types";

import type { AdminViewMode } from "@/features/home/lib/adminMode";
import type { SleeperLeagueOption, SleeperUserSession } from "@/features/home/lib/leagueHistory";

export const REPORT_CACHE_DATA_VERSION = "sleeper-only-startup-adp-v1";
export const REPORT_CACHE_KEY = "dynasty-degenerates:last-report:v29";
export const REPORT_CACHE_DB_NAME = "dynasty-degenerates-report-cache";
export const REPORT_CACHE_DB_VERSION = 1;
export const REPORT_CACHE_DB_STORE = "reports";
export const REPORT_CACHE_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const STALE_REPORT_CACHE_KEYS = [
  "dynasty-degenerates:last-report:v10",
  "dynasty-degenerates:last-report:v11",
  "dynasty-degenerates:last-report:v12",
  "dynasty-degenerates:last-report:v13",
  "dynasty-degenerates:last-report:v14",
  "dynasty-degenerates:last-report:v15",
  "dynasty-degenerates:last-report:v16",
  "dynasty-degenerates:last-report:v17",
  "dynasty-degenerates:last-report:v18",
  "dynasty-degenerates:last-report:v19",
  "dynasty-degenerates:last-report:v20",
  "dynasty-degenerates:last-report:v21",
  "dynasty-degenerates:last-report:v22",
  "dynasty-degenerates:last-report:v23",
  "dynasty-degenerates:last-report:v24",
  "dynasty-degenerates:last-report:v25",
  "dynasty-degenerates:last-report:v26",
  "dynasty-degenerates:last-report:v27",
  "dynasty-degenerates:last-report:v28",
];

export type CachedReport = {
  cacheVersion?: string;
  leagueId: string;
  leagueName: string;
  leagueLogo: string | null;
  leagueFormat: string;
  activeTab: string;
  reportData: ReportData;
  savedAt: number;
};

export type LastLeague = Omit<CachedReport, "reportData">;

export type SleeperSession = {
  username: string;
  user?: SleeperUserSession | null;
  leagues: SleeperLeagueOption[];
  adminViewMode?: AdminViewMode | null;
  savedAt: number;
};

export function formatMutationErrorMessage(error: { message: string }) {
  return `Error: ${error.message}`;
}

export function showMutationErrorToast(error: { message: string }) {
  if (error.message === UNAUTHED_ERR_MSG) return;
  toast.error(formatMutationErrorMessage(error));
}

export function hasDraftReportData(reportData?: ReportData | null): boolean {
  if (!reportData) return false;
  const draftPicks = reportData.draftPicks || [];
  const draftStats = reportData.draftStats || [];
  const leagueValueMode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );

  if (leagueValueMode !== "redraft") {
    return draftPicks.length > 0 || draftStats.length > 0;
  }

  const diagnostics = reportData.leagueDiagnostics;
  if (typeof diagnostics?.hasCurrentSeasonMainDraft === "boolean") {
    return diagnostics.hasCurrentSeasonMainDraft;
  }

  // Older cached reports may have current draft picks but no draft diagnostics.
  const currentSeason = String(
    diagnostics?.currentSeason || new Date().getFullYear()
  );

  return draftPicks.some(pick => {
    const draftYear = pick.draftYear ? String(pick.draftYear) : "";
    const draftKind = pick.draftKind || "main";
    const hasPlayer =
      Boolean(pick.player_id) ||
      (Boolean(pick.playerName) && pick.playerName !== "Unknown");

    return draftYear === currentSeason && draftKind === "main" && hasPlayer;
  });
}

export function isFreshTimestamp(value: unknown, maxAgeMs: number): boolean {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return false;
  }
  return Date.now() - value <= maxAgeMs;
}

export function getReportCacheDbKey(leagueId?: string | null): string {
  const normalizedLeagueId = String(leagueId || "").trim();
  return normalizedLeagueId
    ? `${REPORT_CACHE_KEY}:${normalizedLeagueId}`
    : REPORT_CACHE_KEY;
}

export function normalizeReportLeagueId(value: unknown): string {
  return String(value || "").trim();
}

export function getReportDataLeagueId(reportData?: ReportData | null): string {
  return normalizeReportLeagueId(reportData?.leagueId);
}

export function withReportDataLeagueId(
  reportData: ReportData,
  leagueId?: string | null
): ReportData {
  const normalizedLeagueId = normalizeReportLeagueId(leagueId);
  if (!normalizedLeagueId || getReportDataLeagueId(reportData) === normalizedLeagueId) {
    return reportData;
  }
  return {
    ...reportData,
    leagueId: normalizedLeagueId,
  };
}

export function hasMatchingCachedReportLeagueIdentity(
  report: CachedReport,
  leagueId?: string | null
): boolean {
  const expectedLeagueId = normalizeReportLeagueId(leagueId);
  const cachedLeagueId = normalizeReportLeagueId(report.leagueId);
  const reportDataLeagueId = getReportDataLeagueId(report.reportData);
  if (!cachedLeagueId) return false;
  if (expectedLeagueId && cachedLeagueId !== expectedLeagueId) return false;
  if (reportDataLeagueId && reportDataLeagueId !== cachedLeagueId) return false;
  return true;
}

export function normalizeCachedReportLeagueIdentity(report: CachedReport): CachedReport {
  const normalizedLeagueId = normalizeReportLeagueId(report.leagueId);
  if (!normalizedLeagueId) return report;
  const reportData = withReportDataLeagueId(report.reportData, normalizedLeagueId);
  return reportData === report.reportData ? report : { ...report, reportData };
}

export function isUsableCachedReport(
  report: CachedReport | null,
  leagueId?: string | null
): boolean {
  if (!report) return false;
  return (
    report.cacheVersion === REPORT_CACHE_DATA_VERSION &&
    hasMatchingCachedReportLeagueIdentity(report, leagueId) &&
    isFreshTimestamp(report.savedAt, REPORT_CACHE_MAX_AGE_MS)
  );
}

export function shouldBackgroundRefreshCachedReport(report: CachedReport | null) {
  if (!report || !isUsableCachedReport(report)) return false;
  return Date.now() - report.savedAt >= 0;
}

function openReportCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    const request = window.indexedDB.open(
      REPORT_CACHE_DB_NAME,
      REPORT_CACHE_DB_VERSION
    );
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REPORT_CACHE_DB_STORE)) {
        db.createObjectStore(REPORT_CACHE_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readIndexedDbReportCache(
  leagueId?: string | null
): Promise<CachedReport | null> {
  const db = await openReportCacheDb();
  if (!db) return null;

  return new Promise(resolve => {
    const transaction = db.transaction(REPORT_CACHE_DB_STORE, "readonly");
    const store = transaction.objectStore(REPORT_CACHE_DB_STORE);
    const request = store.get(getReportCacheDbKey(leagueId));
    request.onsuccess = () => {
      const cachedReport = (request.result as CachedReport) || null;
      resolve(
        cachedReport
          ? normalizeCachedReportLeagueIdentity(sanitizeCachedReport(cachedReport))
          : null
      );
    };
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

async function writeIndexedDbReportCache(report: CachedReport): Promise<void> {
  const db = await openReportCacheDb();
  if (!db) return;
  const sanitizedReport = normalizeCachedReportLeagueIdentity(
    sanitizeCachedReport(report)
  );

  await new Promise<void>(resolve => {
    const transaction = db.transaction(REPORT_CACHE_DB_STORE, "readwrite");
    const store = transaction.objectStore(REPORT_CACHE_DB_STORE);
    store.put(sanitizedReport, REPORT_CACHE_KEY);
    store.put(sanitizedReport, getReportCacheDbKey(sanitizedReport.leagueId));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

async function clearIndexedDbReportCache(leagueId?: string | null): Promise<void> {
  const db = await openReportCacheDb();
  if (!db) return;

  await new Promise<void>(resolve => {
    const transaction = db.transaction(REPORT_CACHE_DB_STORE, "readwrite");
    const store = transaction.objectStore(REPORT_CACHE_DB_STORE);
    store.delete(REPORT_CACHE_KEY);
    if (leagueId) store.delete(getReportCacheDbKey(leagueId));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

export function clearBrowserReportCache(leagueId?: string | null) {
  localStorage.removeItem(REPORT_CACHE_KEY);
  const normalizedLeagueId = normalizeReportLeagueId(leagueId);
  if (normalizedLeagueId) {
    localStorage.removeItem(getReportCacheDbKey(normalizedLeagueId));
  }
  void clearIndexedDbReportCache(leagueId);
}

function readLocalStorageReportCache(key: string): CachedReport | null {
  try {
    const cachedReport = localStorage.getItem(key);
    if (!cachedReport) return null;
    return normalizeCachedReportLeagueIdentity(
      sanitizeCachedReport(JSON.parse(cachedReport) as CachedReport)
    );
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export async function readBrowserReportCache(
  leagueId?: string | null
): Promise<CachedReport | null> {
  const normalizedLeagueId = normalizeReportLeagueId(leagueId);
  if (normalizedLeagueId) {
    const leagueLocalReport = readLocalStorageReportCache(
      getReportCacheDbKey(normalizedLeagueId)
    );
    if (isUsableCachedReport(leagueLocalReport, normalizedLeagueId)) {
      return leagueLocalReport;
    }

    const leagueIndexedReport = await readIndexedDbReportCache(normalizedLeagueId);
    if (isUsableCachedReport(leagueIndexedReport, normalizedLeagueId)) {
      return leagueIndexedReport;
    }

    const globalLocalReport = readLocalStorageReportCache(REPORT_CACHE_KEY);
    return isUsableCachedReport(globalLocalReport, normalizedLeagueId)
      ? globalLocalReport
      : null;
  }

  const globalLocalReport = readLocalStorageReportCache(REPORT_CACHE_KEY);
  if (isUsableCachedReport(globalLocalReport)) return globalLocalReport;
  const globalIndexedReport = await readIndexedDbReportCache();
  return isUsableCachedReport(globalIndexedReport) ? globalIndexedReport : null;
}

export function writeBrowserReportCache(report: CachedReport) {
  const sanitizedReport = normalizeCachedReportLeagueIdentity(
    sanitizeCachedReport(report)
  );
  void writeIndexedDbReportCache(sanitizedReport);
  try {
    localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(sanitizedReport));
    localStorage.setItem(
      getReportCacheDbKey(sanitizedReport.leagueId),
      JSON.stringify(sanitizedReport)
    );
  } catch {
    localStorage.removeItem(REPORT_CACHE_KEY);
    localStorage.removeItem(getReportCacheDbKey(sanitizedReport.leagueId));
  }
}
