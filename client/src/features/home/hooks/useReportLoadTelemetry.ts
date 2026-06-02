import { useCallback, useRef, type MutableRefObject } from "react";

import {
  persistReportLoadTelemetry,
  type ReportLoadTelemetryEvent,
} from "@/features/home/lib/adminSessionState";

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
          persistReportLoadTelemetry({
            ...event,
            visibleMs: Math.round(performance.now() - startedAt),
            createdAt: new Date().toISOString(),
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
