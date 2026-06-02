import { useEffect, useMemo, useState } from "react";

import {
  buildReportDeltaSnapshot,
  readReportDeltaSnapshot,
  type ReportDeltaSnapshot,
  writeReportDeltaSnapshot,
} from "@/features/home/lib/reportDelta";
import type { ReportData } from "@shared/types";

type UseReportDeltaSnapshotsInput = {
  reportData: ReportData | null;
  leagueId: string;
  leagueName: string;
};

export function useReportDeltaSnapshots({
  leagueId,
  leagueName,
  reportData,
}: UseReportDeltaSnapshotsInput) {
  const [previousReportDeltaSnapshot, setPreviousReportDeltaSnapshot] =
    useState<ReportDeltaSnapshot | null>(null);
  const currentReportDeltaSnapshot = useMemo(
    () =>
      reportData
        ? buildReportDeltaSnapshot(reportData, leagueId, leagueName)
        : null,
    [leagueId, leagueName, reportData]
  );

  useEffect(() => {
    if (!currentReportDeltaSnapshot) {
      setPreviousReportDeltaSnapshot(null);
      return;
    }

    const previousSnapshot = readReportDeltaSnapshot(
      currentReportDeltaSnapshot.leagueId
    );
    setPreviousReportDeltaSnapshot(previousSnapshot);
    writeReportDeltaSnapshot(currentReportDeltaSnapshot);
  }, [currentReportDeltaSnapshot]);

  return {
    currentReportDeltaSnapshot,
    previousReportDeltaSnapshot,
  };
}
