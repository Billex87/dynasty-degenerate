import { useEffect, useMemo, useRef } from "react";

import { trpc } from "@/lib/trpc";
import {
  buildAIPredictionEventsForReport,
  getAIPredictionEventBatchSignature,
} from "@/lib/aiPredictionEvents";
import type { ReportData } from "@shared/types";

type UseHomeAIPredictionTelemetryInput = {
  enabled: boolean;
  leagueId: string;
  leagueName: string;
  reportData: ReportData | null;
};

export function useHomeAIPredictionTelemetry({
  enabled,
  leagueId,
  leagueName,
  reportData,
}: UseHomeAIPredictionTelemetryInput) {
  const lastBatchSignatureRef = useRef("");
  const aiPredictionMutation = trpc.aiPredictions.upsertMany.useMutation({
    retry: false,
  });
  const aiPredictionEvents = useMemo(
    () =>
      buildAIPredictionEventsForReport({
        reportData,
        leagueId,
        leagueName,
        manager: reportData?.viewerManager || null,
      }),
    [leagueId, leagueName, reportData]
  );
  const aiPredictionBatchSignature = useMemo(
    () => getAIPredictionEventBatchSignature(aiPredictionEvents),
    [aiPredictionEvents]
  );

  useEffect(() => {
    if (!enabled || !aiPredictionEvents.length || !aiPredictionBatchSignature) {
      return;
    }
    if (lastBatchSignatureRef.current === aiPredictionBatchSignature) {
      return;
    }
    lastBatchSignatureRef.current = aiPredictionBatchSignature;
    aiPredictionMutation.mutate({ events: aiPredictionEvents });
  }, [
    aiPredictionBatchSignature,
    aiPredictionEvents,
    aiPredictionMutation,
    enabled,
  ]);
}
