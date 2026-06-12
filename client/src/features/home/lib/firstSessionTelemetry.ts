import { track } from "@vercel/analytics";

import {
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import type { ReportData } from "@shared/types";

const LOCAL_TELEMETRY_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const FIRST_SESSION_EVENT_PREFIX = "First Session";
const FIRST_SESSION_EVENT_NAME = "dynasty-degens:first-session-funnel";

export type FirstSessionFunnelEventName =
  | "Home Viewed"
  | "Sleeper Username Submitted"
  | "League ID Submitted"
  | "League Picker Opened"
  | "League Selected"
  | "Analysis Started"
  | "Sample Report CTA Clicked"
  | "Report Visible";

export type FirstSessionEntryMethod =
  | "username"
  | "league_id"
  | "league_picker"
  | "sample_report"
  | "cached_report"
  | "unknown";

export type FirstSessionViewportBucket =
  | "mobile"
  | "tablet"
  | "desktop"
  | "unknown";

export type FirstSessionReportMode = "dynasty" | "redraft" | "unknown";

export type FirstSessionFunnelProperties = {
  entryMethod?: FirstSessionEntryMethod;
  trigger?:
    | "home"
    | "sample_report"
    | "username_lookup_success"
    | "report_header"
    | "change_league";
  viewport?: FirstSessionViewportBucket;
  leagueCountBucket?: "0" | "1" | "2-3" | "4-7" | "8+";
  reportMode?: FirstSessionReportMode;
  reportSource?: "browser-cache" | "server" | "sample";
  cacheStatus?: "browser" | "hit" | "miss" | "unknown";
  activeTab?:
    | "overview"
    | "momentum"
    | "rankings"
    | "trades"
    | "draft"
    | "other";
  elapsedMsBucket?:
    | "<1s"
    | "1-3s"
    | "3-10s"
    | "10-30s"
    | "30s+"
    | "unknown";
  requestMsBucket?:
    | "<1s"
    | "1-3s"
    | "3-10s"
    | "10-30s"
    | "30s+"
    | "unknown";
  hasLeagueParam?: boolean;
  hasSleeperSession?: boolean;
};

export type FirstSessionFunnelDetail = {
  event: FirstSessionFunnelEventName;
  properties: FirstSessionFunnelProperties;
};

const ENTRY_METHODS = [
  "username",
  "league_id",
  "league_picker",
  "sample_report",
  "cached_report",
  "unknown",
] as const;
const TRIGGERS = [
  "home",
  "sample_report",
  "username_lookup_success",
  "report_header",
  "change_league",
] as const;
const VIEWPORTS = ["mobile", "tablet", "desktop", "unknown"] as const;
const LEAGUE_COUNT_BUCKETS = ["0", "1", "2-3", "4-7", "8+"] as const;
const REPORT_MODES = ["dynasty", "redraft", "unknown"] as const;
const REPORT_SOURCES = ["browser-cache", "server", "sample"] as const;
const CACHE_STATUSES = ["browser", "hit", "miss", "unknown"] as const;
const ACTIVE_TABS = [
  "overview",
  "momentum",
  "rankings",
  "trades",
  "draft",
] as const;
const TIME_BUCKETS = [
  "<1s",
  "1-3s",
  "3-10s",
  "10-30s",
  "30s+",
  "unknown",
] as const;

function isAllowedValue<TValue extends string>(
  allowedValues: readonly TValue[],
  value: unknown
): value is TValue {
  return (
    typeof value === "string" &&
    (allowedValues as readonly string[]).includes(value)
  );
}

export function getViewportBucket(width?: number): FirstSessionViewportBucket {
  const resolvedWidth =
    typeof width === "number"
      ? width
      : typeof window !== "undefined"
        ? window.innerWidth
        : null;

  if (!resolvedWidth) return "unknown";
  if (resolvedWidth < 640) return "mobile";
  if (resolvedWidth < 1024) return "tablet";
  return "desktop";
}

export function getLeagueCountBucket(
  leagueCount: number | null | undefined
): NonNullable<FirstSessionFunnelProperties["leagueCountBucket"]> {
  const count = Number(leagueCount || 0);
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count <= 3) return "2-3";
  if (count <= 7) return "4-7";
  return "8+";
}

export function getElapsedMsBucket(
  elapsedMs: number | null | undefined
): NonNullable<FirstSessionFunnelProperties["elapsedMsBucket"]> {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs)) {
    return "unknown";
  }
  if (elapsedMs < 1000) return "<1s";
  if (elapsedMs < 3000) return "1-3s";
  if (elapsedMs < 10_000) return "3-10s";
  if (elapsedMs < 30_000) return "10-30s";
  return "30s+";
}

export function getReportModeBucket(
  reportData?: ReportData | null,
  leagueValueMode?: LeagueValueMode | null
): FirstSessionReportMode {
  const rawMode =
    leagueValueMode ||
    reportData?.leagueDiagnostics?.valueMode ||
    reportData?.leagueValueMode;
  if (!rawMode && !reportData) return "unknown";

  const mode = normalizeLeagueValueMode(rawMode);

  return mode === "redraft" ? "redraft" : "dynasty";
}

export function getActiveTabBucket(
  activeTab: FirstSessionFunnelProperties["activeTab"] | string | undefined
): FirstSessionFunnelProperties["activeTab"] {
  if (isAllowedValue(ACTIVE_TABS, activeTab)) {
    return activeTab;
  }

  return activeTab ? "other" : undefined;
}

export function sanitizeFirstSessionFunnelProperties(
  properties: Record<string, unknown> | FirstSessionFunnelProperties
): FirstSessionFunnelProperties {
  const rawProperties = properties as Record<string, unknown>;
  const sanitized: FirstSessionFunnelProperties = {};

  if (isAllowedValue(ENTRY_METHODS, rawProperties.entryMethod)) {
    sanitized.entryMethod = rawProperties.entryMethod;
  }
  if (isAllowedValue(TRIGGERS, rawProperties.trigger)) {
    sanitized.trigger = rawProperties.trigger;
  }
  if (isAllowedValue(VIEWPORTS, rawProperties.viewport)) {
    sanitized.viewport = rawProperties.viewport;
  }
  if (isAllowedValue(LEAGUE_COUNT_BUCKETS, rawProperties.leagueCountBucket)) {
    sanitized.leagueCountBucket = rawProperties.leagueCountBucket;
  }
  if (isAllowedValue(REPORT_MODES, rawProperties.reportMode)) {
    sanitized.reportMode = rawProperties.reportMode;
  }
  if (isAllowedValue(REPORT_SOURCES, rawProperties.reportSource)) {
    sanitized.reportSource = rawProperties.reportSource;
  }
  if (isAllowedValue(CACHE_STATUSES, rawProperties.cacheStatus)) {
    sanitized.cacheStatus = rawProperties.cacheStatus;
  }
  sanitized.activeTab = getActiveTabBucket(
    rawProperties.activeTab as string | undefined
  );
  if (isAllowedValue(TIME_BUCKETS, rawProperties.elapsedMsBucket)) {
    sanitized.elapsedMsBucket = rawProperties.elapsedMsBucket;
  }
  if (isAllowedValue(TIME_BUCKETS, rawProperties.requestMsBucket)) {
    sanitized.requestMsBucket = rawProperties.requestMsBucket;
  }
  if (typeof rawProperties.hasLeagueParam === "boolean") {
    sanitized.hasLeagueParam = rawProperties.hasLeagueParam;
  }
  if (typeof rawProperties.hasSleeperSession === "boolean") {
    sanitized.hasSleeperSession = rawProperties.hasSleeperSession;
  }

  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value !== undefined)
  ) as FirstSessionFunnelProperties;
}

function shouldSendFirstSessionTelemetry() {
  if (!import.meta.env.PROD || typeof window === "undefined") return false;
  return !LOCAL_TELEMETRY_HOSTS.has(window.location.hostname);
}

export function trackFirstSessionFunnelEvent(
  event: FirstSessionFunnelEventName,
  properties: FirstSessionFunnelProperties = {}
) {
  const sanitizedProperties =
    sanitizeFirstSessionFunnelProperties(properties);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<FirstSessionFunnelDetail>(FIRST_SESSION_EVENT_NAME, {
        detail: {
          event,
          properties: sanitizedProperties,
        },
      })
    );
  }

  if (!shouldSendFirstSessionTelemetry()) return;

  try {
    track(`${FIRST_SESSION_EVENT_PREFIX} ${event}`, sanitizedProperties);
  } catch {
    // Funnel telemetry must never block user flows.
  }
}
