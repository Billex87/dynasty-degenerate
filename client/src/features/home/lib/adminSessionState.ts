export type ReportLoadSource = "browser-cache" | "server";
export type ReportLoadCacheStatus = "browser" | "hit" | "miss" | "unknown";
export type ReportAnalysisMode = "blocking" | "background";
export type ReportLoadMode = "dynasty" | "redraft" | "unknown";

export type ReportLoadTelemetryEvent = {
  leagueId: string;
  leagueName?: string | null;
  activeTab: string;
  source: ReportLoadSource;
  cacheStatus: ReportLoadCacheStatus;
  reportMode?: ReportLoadMode;
  requestMs: number | null;
  visibleMs: number;
  payloadVersion: string;
  createdAt: string;
};

export type AdminAuthUser = {
  role?: string | null;
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  isPrivilegedAdmin?: boolean | null;
};

const ADMIN_PASSPHRASE_VERIFIED_SESSION_KEY =
  "dynasty-degenerates:admin-passphrase-verified-session:v1";
const REPORT_LOAD_TELEMETRY_KEY =
  "dynasty-degenerates:report-load-telemetry:v1";

export function readAdminPassphraseVerifiedForSession() {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.sessionStorage.getItem(ADMIN_PASSPHRASE_VERIFIED_SESSION_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
}

export function rememberAdminPassphraseVerifiedForSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      ADMIN_PASSPHRASE_VERIFIED_SESSION_KEY,
      "true"
    );
  } catch {
    // Admin access still works for the current React session.
  }
}

export function canViewAdminTelemetryForUser(
  user?: AdminAuthUser | null
): boolean {
  if (!user) return false;
  return user.role === "admin" || Boolean(user.isPrivilegedAdmin);
}

export function persistReportLoadTelemetry(event: ReportLoadTelemetryEvent) {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(
      window.localStorage.getItem(REPORT_LOAD_TELEMETRY_KEY) || "[]"
    ) as ReportLoadTelemetryEvent[];
    window.localStorage.setItem(
      REPORT_LOAD_TELEMETRY_KEY,
      JSON.stringify([event, ...existing].slice(0, 25))
    );
    window.dispatchEvent(
      new CustomEvent("dynasty-degenerates:report-load-telemetry", {
        detail: event,
      })
    );
    if (!import.meta.env.PROD) {
      console.info("[ReportLoadTelemetry]", event);
    }
  } catch {
    // Timing telemetry should never block report rendering.
  }
}
