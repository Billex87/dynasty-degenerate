import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";

import {
  getInitialReportTabFromUrl,
  updateReportTabUrl,
} from "@/features/home/lib/reportRouteState";
import { runViewTransition, useAnimationsEnabled } from "@/lib/motion";
import type { ReportData } from "@shared/types";

type UseHomeReportTabActionsOptions = {
  activeTab: string;
  setActiveTab: Dispatch<SetStateAction<string>>;
  leagueId: string;
  reportData: ReportData | null;
  canViewAutopilotTab: boolean;
  canViewHacksTab: boolean;
  shouldShowDraftHistoryTab: boolean;
  isAuthLoading: boolean;
  shouldDeferAutopilotUrlSync: boolean;
  resolvedActiveTab: string;
  setRosterScannerFocusKey: Dispatch<SetStateAction<number>>;
};

export function useHomeReportTabActions({
  activeTab,
  setActiveTab,
  leagueId,
  reportData,
  canViewAutopilotTab,
  canViewHacksTab,
  shouldShowDraftHistoryTab,
  isAuthLoading,
  shouldDeferAutopilotUrlSync,
  resolvedActiveTab,
  setRosterScannerFocusKey,
}: UseHomeReportTabActionsOptions) {
  const autopilotAccessToastShownRef = useRef(false);
  const animationsEnabled = useAnimationsEnabled();

  const showAutopilotAccessToast = useCallback(() => {
    if (autopilotAccessToastShownRef.current) return;
    autopilotAccessToastShownRef.current = true;
    toast.info("AI Autopilot is available in admin mode for now.");
  }, []);

  const handleReportTabChange = useCallback(
    (nextTab: string) => {
      const isBlockedAutopilotTab =
        nextTab === "autopilot" && !canViewAutopilotTab;
      const isBlockedDraftTab =
        nextTab === "draft" && !shouldShowDraftHistoryTab;
      const isBlockedHacksTab =
        nextTab === "hacks" && !canViewHacksTab;
      if (isBlockedAutopilotTab) {
        showAutopilotAccessToast();
      }
      if (isBlockedHacksTab) {
        toast.info("Hacks are admin-only.");
      }
      const allowedNextTab =
        isBlockedAutopilotTab || isBlockedDraftTab || isBlockedHacksTab
          ? "overview"
          : nextTab;
      if (allowedNextTab === activeTab) {
        updateReportTabUrl(allowedNextTab, leagueId);
        return;
      }

      runViewTransition(
        () => {
          setActiveTab(allowedNextTab);
          updateReportTabUrl(allowedNextTab, leagueId);
        },
        { enabled: animationsEnabled }
      );
    },
    [
      activeTab,
      animationsEnabled,
      canViewAutopilotTab,
      canViewHacksTab,
      leagueId,
      setActiveTab,
      shouldShowDraftHistoryTab,
      showAutopilotAccessToast,
    ]
  );

  const handleScoutLeaguemates = useCallback(() => {
    runViewTransition(
      () => {
        setActiveTab("rankings");
        updateReportTabUrl("rankings", leagueId);
      },
      { enabled: animationsEnabled && activeTab !== "rankings" }
    );
    window.setTimeout(() => {
      setRosterScannerFocusKey(current => current + 1);
    }, 0);
  }, [
    activeTab,
    animationsEnabled,
    leagueId,
    setActiveTab,
    setRosterScannerFocusKey,
  ]);

  useEffect(() => {
    if (activeTab === "autopilot" && !canViewAutopilotTab && !isAuthLoading) {
      showAutopilotAccessToast();
      setActiveTab("overview");
      updateReportTabUrl("overview", leagueId);
      return;
    }

    if (activeTab === "hacks" && !canViewHacksTab && !isAuthLoading) {
      toast.info("Hacks are admin-only.");
      setActiveTab("overview");
      updateReportTabUrl("overview", leagueId);
      return;
    }

    if (activeTab === "projections") {
      setActiveTab("rankings");
      updateReportTabUrl("rankings", leagueId);
    }
  }, [
    activeTab,
    canViewAutopilotTab,
    canViewHacksTab,
    isAuthLoading,
    leagueId,
    setActiveTab,
    showAutopilotAccessToast,
  ]);

  useEffect(() => {
    if (!reportData || activeTab !== "draft" || shouldShowDraftHistoryTab)
      return;

    setActiveTab("overview");
    updateReportTabUrl("overview", leagueId);
  }, [
    activeTab,
    leagueId,
    reportData,
    setActiveTab,
    shouldShowDraftHistoryTab,
  ]);

  useEffect(() => {
    if (!reportData || !leagueId) return;
    if (shouldDeferAutopilotUrlSync) return;
    updateReportTabUrl(resolvedActiveTab, leagueId);
  }, [leagueId, reportData, resolvedActiveTab, shouldDeferAutopilotUrlSync]);

  useEffect(() => {
    if (!reportData) return;
    const syncTabFromUrl = () => {
      const tabFromUrl = getInitialReportTabFromUrl();
      if (!tabFromUrl) return;
      setActiveTab(tabFromUrl);
    };
    syncTabFromUrl();
    window.addEventListener("hashchange", syncTabFromUrl);
    return () => window.removeEventListener("hashchange", syncTabFromUrl);
  }, [reportData, setActiveTab]);

  return {
    handleReportTabChange,
    handleScoutLeaguemates,
  };
}
