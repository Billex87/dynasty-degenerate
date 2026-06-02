import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import { trpc } from "@/lib/trpc";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import type {
  AnalysisLoadingLeague,
  LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import type { AnalysisLeaguePreview } from "@/features/home/lib/leagueHistory";
import {
  findKnownSleeperLeague,
  getAnalysisLeaguePreview,
  getLeagueIdAnalysisPreview,
  type CachedSleeperUser,
  type SleeperLeagueOption,
} from "@/features/home/lib/leagueHistory";
import type { ReportAnalysisMode } from "@/features/home/lib/adminSessionState";

type UseHomeAnalysisLoadingOptions = {
  activeAnalysisLeagueIdRef: MutableRefObject<string | null>;
  analysisModeRef: MutableRefObject<ReportAnalysisMode>;
  cachedSleeperUsers: CachedSleeperUser[];
  reportLoadStartedAtRef: MutableRefObject<number | null>;
  userLeagues: SleeperLeagueOption[];
  setAnalysisCompleteMessage: Dispatch<SetStateAction<AnalysisLoadingLeague | null>>;
  setHasLoadingTimedOut: Dispatch<SetStateAction<boolean>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setLoadingManagerAnchors: Dispatch<SetStateAction<LoaderManagerAnchor[]>>;
  setLoadingTransitionPhase: Dispatch<SetStateAction<LoadingTransitionPhase>>;
  setPendingAnalysisLeague: Dispatch<SetStateAction<AnalysisLeaguePreview | null>>;
};

export function useHomeAnalysisLoading({
  activeAnalysisLeagueIdRef,
  analysisModeRef,
  cachedSleeperUsers,
  reportLoadStartedAtRef,
  userLeagues,
  setAnalysisCompleteMessage,
  setHasLoadingTimedOut,
  setIsLoading,
  setLoadingManagerAnchors,
  setLoadingTransitionPhase,
  setPendingAnalysisLeague,
}: UseHomeAnalysisLoadingOptions) {
  const leaguePreviewMutation = trpc.league.getLeaguePreview.useMutation();

  const beginAnalysisLoading = async (
    nextLeagueId: string,
    extraKnownLeagues: SleeperLeagueOption[] = [],
    initialManagerAnchors: LoaderManagerAnchor[] = []
  ) => {
    analysisModeRef.current = "blocking";
    activeAnalysisLeagueIdRef.current = nextLeagueId;
    reportLoadStartedAtRef.current = performance.now();
    const knownLeague = findKnownSleeperLeague(
      nextLeagueId,
      userLeagues,
      cachedSleeperUsers,
      extraKnownLeagues
    );

    setPendingAnalysisLeague(
      knownLeague
        ? getAnalysisLeaguePreview(knownLeague)
        : getLeagueIdAnalysisPreview(nextLeagueId)
    );
    setAnalysisCompleteMessage(null);
    setLoadingTransitionPhase("loading");
    setHasLoadingTimedOut(false);
    setIsLoading(true);
    setLoadingManagerAnchors(initialManagerAnchors);

    try {
      const league = await leaguePreviewMutation.mutateAsync({
        leagueId: nextLeagueId,
      });
      if (activeAnalysisLeagueIdRef.current !== league.leagueId) return;
      if (!knownLeague) {
        setPendingAnalysisLeague(getAnalysisLeaguePreview(league));
      }
      if (league.managerAnchors?.length) {
        setLoadingManagerAnchors(league.managerAnchors);
      }
    } catch {
      // The full analysis request owns the user-facing error state.
    }
  };

  return {
    beginAnalysisLoading,
  };
}
