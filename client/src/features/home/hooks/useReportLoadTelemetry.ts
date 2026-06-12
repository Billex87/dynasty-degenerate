import { useCallback, useRef, type MutableRefObject } from "react";

import {
  persistReportLoadTelemetry,
  type ReportLoadTelemetryEvent,
} from "@/features/home/lib/adminSessionState";
import {
  getActiveTabBucket,
  getElapsedMsBucket,
  trackFirstSessionFunnelEvent,
} from "@/features/home/lib/firstSessionTelemetry";

type UseReportLoadTelemetryInput = {
  reportLoadStartedAtRef: MutableRefObject<number | null>;
  analyzeRequestStartedAtRef: MutableRefObject<{
    leagueId: string;
    startedAt: number;
  } | null>;
};

export function useReportLoadTelemetry({
  analyzeRequestStartedAtRef,
  reportLoadStartedAtRef,
}: UseReportLoadTelemetryInput) {
  const appBootStartedAtRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now()
  );

  return useCallback(
    (event: Omit<ReportLoadTelemetryEvent, "createdAt" | "visibleMs">) => {
      if (typeof window === "undefined") return;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const startedAt =
            event.source === "browser-cache"
              ? appBootStartedAtRef.current
              : reportLoadStartedAtRef.current || performance.now();
          const visibleMs = Math.round(performance.now() - startedAt);
          persistReportLoadTelemetry({
            ...event,
            visibleMs,
            createdAt: new Date().toISOString(),
          });
          trackFirstSessionFunnelEvent("Report Visible", {
            reportSource: event.source,
            cacheStatus: event.cacheStatus,
            reportMode: event.reportMode || "unknown",
            activeTab: getActiveTabBucket(event.activeTab),
            elapsedMsBucket: getElapsedMsBucket(visibleMs),
            requestMsBucket: getElapsedMsBucket(event.requestMs),
          });
          if (event.source === "server") {
            reportLoadStartedAtRef.current = null;
            analyzeRequestStartedAtRef.current = null;
          }
        });
      });
    },
    [analyzeRequestStartedAtRef, reportLoadStartedAtRef]
  );
}
