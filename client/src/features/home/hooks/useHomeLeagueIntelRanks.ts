import { useEffect, type Dispatch, type SetStateAction } from "react";

import { trpc } from "@/lib/trpc";
import { getValidSleeperUserId } from "@/features/home/lib/sleeperIdentity";
import {
  getLeagueRankLookupBatch,
  mergeLeagueRanks,
  type SleeperLeagueOption,
} from "@/features/home/lib/leagueHistory";
import type { SleeperSession } from "@/features/home/lib/reportCache";

type UseHomeLeagueIntelRanksOptions = {
  sleeperSessionKey: string;
  sleeperUsername: string;
  userLeagues: SleeperLeagueOption[];
  viewerUserId: string | null;
  viewerUsername: string | null;
  setIsLeagueIntelLoading: Dispatch<SetStateAction<boolean>>;
  setUserLeagues: Dispatch<SetStateAction<SleeperLeagueOption[]>>;
};

function persistSleeperSessionLeagues(
  sleeperSessionKey: string,
  nextLeagues: SleeperLeagueOption[]
) {
  try {
    const sleeperSession = localStorage.getItem(sleeperSessionKey);
    if (!sleeperSession) return;
    const parsed = JSON.parse(sleeperSession) as SleeperSession;
    localStorage.setItem(
      sleeperSessionKey,
      JSON.stringify({
        ...parsed,
        leagues: nextLeagues,
        savedAt: Date.now(),
      } satisfies SleeperSession)
    );
  } catch {
    // Enriched league cards are a convenience cache; the loader can still fetch preview data.
  }
}

export function useHomeLeagueIntelRanks({
  sleeperSessionKey,
  sleeperUsername,
  userLeagues,
  viewerUserId,
  viewerUsername,
  setIsLeagueIntelLoading,
  setUserLeagues,
}: UseHomeLeagueIntelRanksOptions) {
  const userLeagueRanksMutation = trpc.league.getUserLeagueRanks.useMutation({
    onSuccess: data => {
      setUserLeagues(prev => {
        const nextLeagues = mergeLeagueRanks(prev, data.ranks);
        persistSleeperSessionLeagues(sleeperSessionKey, nextLeagues);
        return nextLeagues;
      });
      setIsLeagueIntelLoading(false);
    },
    onError: () => {
      setIsLeagueIntelLoading(false);
    },
  });
  const requestUserLeagueRanks = userLeagueRanksMutation.mutate;

  useEffect(() => {
    if (!viewerUserId || !sleeperUsername || !userLeagues.length) {
      setIsLeagueIntelLoading(false);
      return;
    }
    const validViewerUserId = getValidSleeperUserId(viewerUserId);
    if (!validViewerUserId) {
      setIsLeagueIntelLoading(false);
      return;
    }
    const leagueIds = getLeagueRankLookupBatch(userLeagues);
    if (!leagueIds.length) {
      setIsLeagueIntelLoading(false);
      return;
    }
    if (userLeagueRanksMutation.isPending) {
      setIsLeagueIntelLoading(true);
      return;
    }

    setIsLeagueIntelLoading(true);
    requestUserLeagueRanks({
      username: sleeperUsername,
      userId: validViewerUserId,
      displayName: viewerUsername || sleeperUsername,
      leagueIds,
    });
  }, [
    requestUserLeagueRanks,
    setIsLeagueIntelLoading,
    sleeperUsername,
    userLeagueRanksMutation.isPending,
    userLeagues,
    viewerUserId,
    viewerUsername,
  ]);

  return {
    isLeagueRanksPending: userLeagueRanksMutation.isPending,
  };
}
