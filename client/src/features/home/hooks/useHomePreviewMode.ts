import { useEffect } from "react";

import {
  buildPreviewLoadingManagerAnchors,
  type AnalysisLeaguePreview,
} from "@/features/home/lib/leagueHistory";
import {
  type AnalysisLoadingLeague,
  type LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";

type HomePreviewMode = string | null;

type UseHomePreviewModeInput = {
  previewMode: HomePreviewMode;
  setIsLoading: (isLoading: boolean) => void;
  setLoadingTransitionPhase: (phase: LoadingTransitionPhase) => void;
  setPendingAnalysisLeague: (league: AnalysisLeaguePreview | null) => void;
  setAnalysisCompleteMessage: (league: AnalysisLoadingLeague | null) => void;
  setLoadingManagerAnchors: (anchors: LoaderManagerAnchor[]) => void;
  setPreviewLoadingLoopTick: (updater: number | ((tick: number) => number)) => void;
};

const PREVIEW_LEAGUE: AnalysisLoadingLeague = {
  leagueName: "The Fantasy Degenerates",
  leagueFormat: "12-Team Dynasty SF PPR TEP",
  leagueLogo: "/favicon-32x32.png",
};

export function useHomePreviewMode({
  previewMode,
  setAnalysisCompleteMessage,
  setIsLoading,
  setLoadingManagerAnchors,
  setLoadingTransitionPhase,
  setPendingAnalysisLeague,
  setPreviewLoadingLoopTick,
}: UseHomePreviewModeInput) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (previewMode === "loading" || previewMode === "success") {
      setIsLoading(true);
      if (previewMode === "success") {
        setLoadingTransitionPhase("success");
        setAnalysisCompleteMessage(PREVIEW_LEAGUE);
        setLoadingManagerAnchors([]);
      } else {
        setLoadingTransitionPhase("loading");
        setPendingAnalysisLeague(PREVIEW_LEAGUE);
        setAnalysisCompleteMessage(null);
        setLoadingManagerAnchors(buildPreviewLoadingManagerAnchors());
      }
      return;
    }

    if (previewMode === "loading-loop") {
      setIsLoading(true);
      setLoadingTransitionPhase("loading");
      setPendingAnalysisLeague(PREVIEW_LEAGUE);
      setAnalysisCompleteMessage(null);
      setLoadingManagerAnchors(buildPreviewLoadingManagerAnchors());
      setPreviewLoadingLoopTick(0);

      const timer = window.setInterval(() => {
        setLoadingTransitionPhase("loading");
        setIsLoading(true);
        setPendingAnalysisLeague(PREVIEW_LEAGUE);
        setAnalysisCompleteMessage(null);
        setLoadingManagerAnchors(buildPreviewLoadingManagerAnchors());
        setPreviewLoadingLoopTick(tick => tick + 1);
      }, 8800);

      return () => window.clearInterval(timer);
    }
  }, [
    previewMode,
    setAnalysisCompleteMessage,
    setIsLoading,
    setLoadingManagerAnchors,
    setLoadingTransitionPhase,
    setPendingAnalysisLeague,
    setPreviewLoadingLoopTick,
  ]);
}
