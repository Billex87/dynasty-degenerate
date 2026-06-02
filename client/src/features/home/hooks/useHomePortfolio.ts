import { useEffect, useMemo } from "react";

import { type HomeLeagueSelectionLeague } from "@/features/home/components/HomeLeagueSelection";
import {
  buildHomePortfolioRows,
  filterHomePortfolioRows,
  type HomePortfolioExposureFilter,
} from "@/features/home/lib/portfolioRows";

type UseHomePortfolioInput = {
  orderedUserLeagues: HomeLeagueSelectionLeague[];
  viewerUserId: string | null;
  isLeagueRanksPending: boolean;
  portfolioSearch: string;
  portfolioExposureFilter: HomePortfolioExposureFilter;
  portfolioLeagueFilter: string;
  setPortfolioLeagueFilter: (value: string) => void;
};

export function useHomePortfolio({
  isLeagueRanksPending,
  orderedUserLeagues,
  portfolioExposureFilter,
  portfolioLeagueFilter,
  portfolioSearch,
  setPortfolioLeagueFilter,
  viewerUserId,
}: UseHomePortfolioInput) {
  const homePortfolioRows = useMemo(
    () => buildHomePortfolioRows(orderedUserLeagues),
    [orderedUserLeagues]
  );
  const filteredHomePortfolioRows = useMemo(
    () =>
      filterHomePortfolioRows(homePortfolioRows, {
        query: portfolioSearch,
        exposure: portfolioExposureFilter,
        leagueId:
          portfolioLeagueFilter === "all" ? undefined : portfolioLeagueFilter,
      }),
    [
      homePortfolioRows,
      portfolioExposureFilter,
      portfolioLeagueFilter,
      portfolioSearch,
    ]
  );
  const isHomePortfolioLoading =
    Boolean(orderedUserLeagues.length) &&
    Boolean(viewerUserId) &&
    isLeagueRanksPending &&
    !homePortfolioRows.length;

  useEffect(() => {
    if (
      portfolioLeagueFilter === "all" ||
      orderedUserLeagues.some(
        league => league.leagueId === portfolioLeagueFilter
      )
    ) {
      return;
    }
    setPortfolioLeagueFilter("all");
  }, [orderedUserLeagues, portfolioLeagueFilter, setPortfolioLeagueFilter]);

  return {
    homePortfolioRows,
    filteredHomePortfolioRows,
    isHomePortfolioLoading,
  };
}
