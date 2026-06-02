import { useEffect } from "react";

import { type LoadingTransitionPhase } from "@/features/report/components/ReportDialogs";

type UseHomeLoadingTimeoutInput = {
  isLoading: boolean;
  loadingTransitionPhase: LoadingTransitionPhase;
  timeoutMs: number;
  setHasLoadingTimedOut: (hasTimedOut: boolean) => void;
};

export function useHomeLoadingTimeout({
  isLoading,
  loadingTransitionPhase,
  setHasLoadingTimedOut,
  timeoutMs,
}: UseHomeLoadingTimeoutInput) {
  useEffect(() => {
    if (!isLoading || loadingTransitionPhase !== "loading") {
      setHasLoadingTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setHasLoadingTimedOut(true);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [isLoading, loadingTransitionPhase, setHasLoadingTimedOut, timeoutMs]);
}
