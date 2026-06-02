import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import type {
  AnalysisLoadingLeague,
  LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import {
  clearBrowserReportCache,
  normalizeReportLeagueId,
} from "@/features/home/lib/reportCache";
import { updateReportTabUrl } from "@/features/home/lib/reportRouteState";
import type { ReportAnalysisMode } from "@/features/home/lib/adminSessionState";
import type {
  AnalysisLeaguePreview,
  SleeperLeagueOption,
} from "@/features/home/lib/leagueHistory";
import type { AdminViewMode } from "@/features/home/lib/adminMode";
import type { ReportData } from "@shared/types";

type AnalyzeHandler = (targetLeagueId?: string) => Promise<void>;

type UseHomeNavigationActionsOptions = {
  activeAnalysisLeagueIdRef: MutableRefObject<string | null>;
  analysisModeRef: MutableRefObject<ReportAnalysisMode>;
  analyzeRequestStartedAtRef: MutableRefObject<{
    leagueId: string;
    startedAt: number;
  } | null>;
  clearSuccessTransitionTimers: () => void;
  lastLeagueKey: string;
  leagueId: string;
  reportData: ReportData | null;
  reportLoadStartedAtRef: MutableRefObject<number | null>;
  sleeperSessionKey: string;
  userLeagues: SleeperLeagueOption[];
  handleAnalyze: AnalyzeHandler;
  setActiveTab: Dispatch<SetStateAction<string>>;
  setAdminPassphrase: Dispatch<SetStateAction<string>>;
  setAdminViewMode: Dispatch<SetStateAction<AdminViewMode | null>>;
  setAdminViewerManager: Dispatch<SetStateAction<string | null>>;
  setAnalysisCompleteMessage: Dispatch<SetStateAction<AnalysisLoadingLeague | null>>;
  setAnalysisErrorMessage: Dispatch<SetStateAction<string | null>>;
  setHasLoadingTimedOut: Dispatch<SetStateAction<boolean>>;
  setIsAdminAccessModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsChangeLeagueModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsLeagueIntelLoading: Dispatch<SetStateAction<boolean>>;
  setIsLeaguePickerOpen: Dispatch<SetStateAction<boolean>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setLeagueFormat: Dispatch<SetStateAction<string>>;
  setLeagueId: Dispatch<SetStateAction<string>>;
  setLeagueLogo: Dispatch<SetStateAction<string | null>>;
  setLeagueName: Dispatch<SetStateAction<string>>;
  setLoadingManagerAnchors: Dispatch<SetStateAction<LoaderManagerAnchor[]>>;
  setLoadingTransitionPhase: Dispatch<SetStateAction<LoadingTransitionPhase>>;
  setPendingAnalysisLeague: Dispatch<SetStateAction<AnalysisLeaguePreview | null>>;
  setPortfolioSearch: Dispatch<SetStateAction<string>>;
  setReportData: Dispatch<SetStateAction<ReportData | null>>;
  setSleeperUsername: Dispatch<SetStateAction<string>>;
  setUserLeagues: Dispatch<SetStateAction<SleeperLeagueOption[]>>;
  setViewerUserId: Dispatch<SetStateAction<string | null>>;
  setViewerUsername: Dispatch<SetStateAction<string | null>>;
};

export function useHomeNavigationActions({
  activeAnalysisLeagueIdRef,
  analysisModeRef,
  analyzeRequestStartedAtRef,
  clearSuccessTransitionTimers,
  lastLeagueKey,
  leagueId,
  reportData,
  reportLoadStartedAtRef,
  sleeperSessionKey,
  userLeagues,
  handleAnalyze,
  setActiveTab,
  setAdminPassphrase,
  setAdminViewMode,
  setAdminViewerManager,
  setAnalysisCompleteMessage,
  setAnalysisErrorMessage,
  setHasLoadingTimedOut,
  setIsAdminAccessModalOpen,
  setIsChangeLeagueModalOpen,
  setIsLeagueIntelLoading,
  setIsLeaguePickerOpen,
  setIsLoading,
  setLeagueFormat,
  setLeagueId,
  setLeagueLogo,
  setLeagueName,
  setLoadingManagerAnchors,
  setLoadingTransitionPhase,
  setPendingAnalysisLeague,
  setPortfolioSearch,
  setReportData,
  setSleeperUsername,
  setUserLeagues,
  setViewerUserId,
  setViewerUsername,
}: UseHomeNavigationActionsOptions) {
  const handleStartOver = () => {
    clearBrowserReportCache();
    localStorage.removeItem(lastLeagueKey);
    localStorage.removeItem(sleeperSessionKey);
    updateReportTabUrl("overview", "");
    clearSuccessTransitionTimers();
    activeAnalysisLeagueIdRef.current = null;
    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    setIsAdminAccessModalOpen(false);
    setAnalysisCompleteMessage(null);
    setAnalysisErrorMessage(null);
    setPendingAnalysisLeague(null);
    setLoadingTransitionPhase("loading");
    setHasLoadingTimedOut(false);
    setLoadingManagerAnchors([]);
    setIsLoading(false);
    setReportData(null);
    setLeagueId("");
    setSleeperUsername("");
    setPortfolioSearch("");
    setLeagueName("");
    setLeagueLogo(null);
    setLeagueFormat("");
    setUserLeagues([]);
    setIsLeagueIntelLoading(false);
    setViewerUserId(null);
    setViewerUsername(null);
    setAdminViewMode(null);
    setAdminViewerManager(null);
    setAdminPassphrase("");
    setActiveTab("overview");
  };

  const handleCancelLoading = () => {
    clearSuccessTransitionTimers();
    activeAnalysisLeagueIdRef.current = null;
    reportLoadStartedAtRef.current = null;
    analyzeRequestStartedAtRef.current = null;
    analysisModeRef.current = "blocking";
    setAnalysisCompleteMessage(null);
    setPendingAnalysisLeague(null);
    setLoadingTransitionPhase("loading");
    setHasLoadingTimedOut(false);
    setLoadingManagerAnchors([]);
    setIsLoading(false);

    if (userLeagues.length > 0) {
      setIsLeaguePickerOpen(true);
      return;
    }

    if (!reportData) {
      updateReportTabUrl("overview", "");
      setLeagueId("");
      setAnalysisErrorMessage(null);
      setLeagueName("");
      setLeagueLogo(null);
      setLeagueFormat("");
      setActiveTab("overview");
    }
  };

  const handleRetryLoading = () => {
    const retryLeagueId =
      activeAnalysisLeagueIdRef.current || normalizeReportLeagueId(leagueId);
    if (!retryLeagueId) {
      handleCancelLoading();
      return;
    }
    void handleAnalyze(retryLeagueId);
  };

  const openLeagueSelector = () => {
    if (userLeagues.length > 0) {
      setIsLeaguePickerOpen(true);
      return;
    }
    setIsChangeLeagueModalOpen(true);
  };

  const handleAnalyzeLeagueOption = async (nextLeagueId: string) => {
    setIsLeaguePickerOpen(false);
    clearBrowserReportCache(nextLeagueId);
    await handleAnalyze(nextLeagueId);
  };

  return {
    handleAnalyzeAnotherLeague: openLeagueSelector,
    handleAnalyzeLeagueOption,
    handleCancelLoading,
    handleHeaderLeagueClick: openLeagueSelector,
    handleRetryLoading,
    handleStartOver,
  };
}
