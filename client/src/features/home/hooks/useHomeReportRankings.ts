import { useMemo } from "react";

import { trpc } from "@/lib/trpc";
import type { ReportData } from "@shared/types";

type UseHomeReportRankingsInput = {
  leagueId: string;
  reportData: ReportData | null;
};

export function useHomeReportRankings({
  leagueId,
  reportData,
}: UseHomeReportRankingsInput) {
  const rankingsQuery = trpc.league.rankingsMeta.useQuery(
    { leagueId },
    {
      enabled: Boolean(reportData && leagueId && !reportData.rankings),
      staleTime: 1000 * 60 * 60 * 12,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );
  const rankingsForReport =
    rankingsQuery.data?.rankings || reportData?.rankings;
  const reportDataWithRankings = useMemo(
    () =>
      reportData && rankingsForReport
        ? { ...reportData, rankings: rankingsForReport }
        : reportData,
    [rankingsForReport, reportData]
  );

  return {
    rankingsForReport,
    rankingsQueryIsLoading: rankingsQuery.isLoading,
    reportDataWithRankings,
  };
}
