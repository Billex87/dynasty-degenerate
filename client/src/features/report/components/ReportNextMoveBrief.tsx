import { track } from "@vercel/analytics";
import { useEffect, useMemo, useRef } from "react";
import { AIActionQueue } from "@/components/AIActionQueue";
import {
  getReportNextMoveDestination,
  getReportNextMoveItems,
  getReportNextMoveTelemetryProperties,
  type ReportNextMoveDestination,
  type ReportNextMoveTelemetryProperties,
} from "@/features/report/lib/reportNextMoveBrief";
import type { LeagueValueMode } from "@/lib/leagueValueMode";
import type { ReportData } from "@shared/types";

const LOCAL_TELEMETRY_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const REPORT_NEXT_MOVE_EVENT_NAME = "Report Next Move Visible";

function shouldSendReportNextMoveTelemetry() {
  if (!import.meta.env.PROD || typeof window === "undefined") return false;
  return !LOCAL_TELEMETRY_HOSTS.has(window.location.hostname);
}

function trackReportNextMoveVisible(
  properties: ReportNextMoveTelemetryProperties
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dynasty-degens:report-next-move-visible", {
        detail: properties,
      })
    );
  }

  if (!shouldSendReportNextMoveTelemetry()) return;

  try {
    track(REPORT_NEXT_MOVE_EVENT_NAME, properties);
  } catch {
    // Analytics must never block report rendering.
  }
}

export function ReportNextMoveBrief({
  reportData,
  leagueId,
  leagueValueMode,
  showReportAIReads = false,
  onFollowDestination,
}: {
  reportData: ReportData;
  leagueId?: string | null;
  leagueValueMode?: LeagueValueMode | null;
  showReportAIReads?: boolean;
  onFollowDestination?: (destination: ReportNextMoveDestination) => void;
}) {
  const items = useMemo(
    () =>
      getReportNextMoveItems({
        reportData,
        leagueValueMode,
        leagueId,
      }),
    [leagueId, leagueValueMode, reportData]
  );
  const primary = items[0] || null;
  const destination = useMemo(
    () =>
      primary
        ? getReportNextMoveDestination({
            item: primary,
            reportData,
            showReportAIReads,
          })
        : null,
    [primary, reportData, showReportAIReads]
  );
  const trackedEventKeyRef = useRef<string | null>(null);
  const telemetryEventKey = primary
    ? [
        leagueValueMode === "redraft" ? "redraft" : "dynasty",
        primary.source,
        primary.decision,
        primary.confidence,
        items.length,
      ].join(":")
    : "";

  useEffect(() => {
    if (!primary || !telemetryEventKey) return;
    if (trackedEventKeyRef.current === telemetryEventKey) return;

    trackedEventKeyRef.current = telemetryEventKey;
    trackReportNextMoveVisible(
      getReportNextMoveTelemetryProperties({
        item: primary,
        leagueValueMode,
        queueCount: items.length,
      })
    );
  }, [items.length, leagueValueMode, primary, telemetryEventKey]);

  if (!primary) return null;

  return (
    <AIActionQueue
      items={items}
      title="Your Next Move"
      subtitle="Overview next move with receipts before any tab dive."
      className="report-next-move-brief"
      memoryKey={`report-next-move:${leagueValueMode === "redraft" ? "redraft" : "dynasty"}:${leagueId || "league"}`}
      memoryContext="Report Overview Next Move"
      maxVisibleItems={1}
      showSuppressedAlternates={false}
      showDiagnostics={false}
      primaryActionLabel={destination?.buttonLabel}
      primaryActionDescription={
        destination
          ? `Open ${destination.sectionTitle} in this report`
          : undefined
      }
      onPrimaryActionClick={
        destination && onFollowDestination
          ? () => onFollowDestination(destination)
          : undefined
      }
    />
  );
}
