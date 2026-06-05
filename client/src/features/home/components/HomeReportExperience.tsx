import { lazy, Suspense, type CSSProperties, type ReactNode } from "react";

import { type PremiumFxVariant } from "@/components/PremiumFxLayer";
import { getReportManagerNames } from "@/features/report/lib/reportOverviewPreview";
import { getReportDashboardManagers } from "@/features/report/lib/reportDashboardUtils";
import {
  buildReportDeltaChanges,
  type ReportDeltaSnapshot,
} from "@/features/home/lib/reportDelta";
import {
  type HomeLeagueSelectionLeague,
  type HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";
import { type HomePortfolioExposureFilter } from "@/features/home/lib/portfolioRows";
import { type OwnerIntelSortMode } from "@/features/report/components/OwnerIntelControls";
import {
  getLeagueModeCopy,
  normalizeLeagueValueMode,
} from "@/lib/leagueValueMode";
import { type AIVoiceMode } from "@/lib/aiVoice";
import type { ReportData, SleeperExtensionTradeCenterSnapshot } from "@shared/types";

const DYNASTY_MOBILE_REPORT_LOGO_SRC =
  "/brand/logos/png/mobile-dd-stacked-transparent.png?v=20260519-mobile-transparent";
const DYNASTY_REPORT_HEADER_LOGO_SRC =
  "/brand/logos/uploads/report-header-logo-compact-transparent-cropped.png?v=20260518-compact-crop";
const SHOW_ASSISTANT_FEATURE_RADAR =
  String(
    import.meta.env.VITE_SHOW_ASSISTANT_FEATURE_RADAR || "true"
  ).toLowerCase() !== "false";

const ReportDashboardShell = lazy(() =>
  import("@/features/report/components/ReportDashboardShell").then(module => ({
    default: module.ReportDashboardShell,
  }))
);
const ReportDashboardContent = lazy(() =>
  import("@/features/report/components/ReportDashboardContent").then(module => ({
    default: module.ReportDashboardContent,
  }))
);

function ReportDashboardChunkFallback() {
  return (
    <div className="report-shell min-h-screen" role="status" aria-live="polite">
      <span className="sr-only">Loading report</span>
    </div>
  );
}

type HomeReportExperienceProps = {
  reportData: ReportData;
  reportDataWithRankings: ReportData | null;
  isLoadingRevealPhase: boolean;
  aiVoiceMode: AIVoiceMode;
  resolvedActiveTab: string;
  onReportTabChange: (nextTab: string) => void;
  hasAdminPermissions: boolean;
  canViewAutopilotTab: boolean;
  shouldShowDraftHistoryTab: boolean;
  reportTabsClassName: string;
  reportTabsStyle: CSSProperties;
  leagueName: string;
  leagueFormat: string;
  leagueId: string;
  leagueFormatPills: string[];
  leagueLogo: string | null;
  leagueLogoInitials: string;
  onHeaderLeagueClick: () => void;
  onAnalyzeAnotherLeague: () => void;
  isChangeLeagueModalOpen: boolean;
  onChangeLeagueOpenChange: (open: boolean) => void;
  onStartOver: () => void;
  canOpenAdminToolsEntry: boolean;
  canViewAdminFeatureExpansion: boolean;
  canViewAdminDiagnostics: boolean;
  isAdminPassphraseVerifiedForSession: boolean;
  adminViewerManager: string | null;
  onAIVoiceModeChange: (mode: AIVoiceMode) => void;
  onAdminToolsClick: () => void;
  onAdminViewerManagerChange: (manager: string | null) => void;
  leagueRosterScannerMode: OwnerIntelSortMode;
  onLeagueRosterScannerModeChange: (mode: OwnerIntelSortMode) => void;
  ownerIntelSortMode: OwnerIntelSortMode;
  onOwnerIntelSortModeChange: (mode: OwnerIntelSortMode) => void;
  rankingsForReport: ReportData["rankings"];
  rankingsQueryIsLoading: boolean;
  onAnalyze: () => void;
  onImportSleeperTradeCenterSnapshot: (
    snapshot: SleeperExtensionTradeCenterSnapshot
  ) => Promise<{
    transactionCount: number;
    tradeCount: number;
    waiverCount: number;
  }>;
  isImportingSleeperTradeCenterSnapshot: boolean;
  onScoutLeaguemates: () => void;
  currentReportDeltaSnapshot: ReportDeltaSnapshot | null;
  previousReportDeltaSnapshot: ReportDeltaSnapshot | null;
  rosterScannerFocusKey: number;
  homePortfolioRows: HomePortfolioRow[];
  filteredHomePortfolioRows: HomePortfolioRow[];
  orderedUserLeagues: HomeLeagueSelectionLeague[];
  isHomePortfolioLoading: boolean;
  portfolioSearch: string;
  portfolioExposureFilter: HomePortfolioExposureFilter;
  portfolioLeagueFilter: string;
  onPortfolioSearchChange: (value: string) => void;
  onPortfolioExposureFilterChange: (value: HomePortfolioExposureFilter) => void;
  onPortfolioLeagueFilterChange: (value: string) => void;
  homeDialogs: ReactNode;
};

export function HomeReportExperience({
  adminViewerManager,
  aiVoiceMode,
  canOpenAdminToolsEntry,
  canViewAdminDiagnostics,
  canViewAdminFeatureExpansion,
  canViewAutopilotTab,
  currentReportDeltaSnapshot,
  filteredHomePortfolioRows,
  hasAdminPermissions,
  homeDialogs,
  homePortfolioRows,
  isAdminPassphraseVerifiedForSession,
  isChangeLeagueModalOpen,
  isHomePortfolioLoading,
  isImportingSleeperTradeCenterSnapshot,
  isLoadingRevealPhase,
  leagueFormat,
  leagueFormatPills,
  leagueId,
  leagueLogo,
  leagueLogoInitials,
  leagueName,
  leagueRosterScannerMode,
  onAIVoiceModeChange,
  onAdminToolsClick,
  onAdminViewerManagerChange,
  onAnalyze,
  onAnalyzeAnotherLeague,
  onChangeLeagueOpenChange,
  onHeaderLeagueClick,
  onImportSleeperTradeCenterSnapshot,
  onLeagueRosterScannerModeChange,
  onOwnerIntelSortModeChange,
  onPortfolioExposureFilterChange,
  onPortfolioLeagueFilterChange,
  onPortfolioSearchChange,
  onReportTabChange,
  onScoutLeaguemates,
  onStartOver,
  orderedUserLeagues,
  ownerIntelSortMode,
  portfolioExposureFilter,
  portfolioLeagueFilter,
  portfolioSearch,
  previousReportDeltaSnapshot,
  rankingsForReport,
  rankingsQueryIsLoading,
  reportData,
  reportDataWithRankings,
  reportTabsClassName,
  reportTabsStyle,
  resolvedActiveTab,
  rosterScannerFocusKey,
  shouldShowDraftHistoryTab,
}: HomeReportExperienceProps) {
  const leagueValueMode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );
  const isRedraftReport = leagueValueMode === "redraft";
  const modeCopy = getLeagueModeCopy(leagueValueMode);
  const reportDataBase = reportDataWithRankings || reportData;
  const selectedViewerManager = canViewAdminFeatureExpansion
    ? (adminViewerManager ?? reportDataBase.viewerManager ?? null)
    : (reportDataBase.viewerManager ?? null);
  const reportManagerNames = getReportManagerNames(
    reportDataBase,
    selectedViewerManager
  );
  const effectiveViewerManager =
    selectedViewerManager && reportManagerNames.includes(selectedViewerManager)
      ? selectedViewerManager
      : null;
  const reportDataForView: ReportData = {
    ...reportDataBase,
    viewerManager: effectiveViewerManager,
  };
  const dashboardManagers = getReportDashboardManagers(reportDataForView);
  const dashboardViewerManager =
    effectiveViewerManager || dashboardManagers[0] || null;
  const hasManagerViewOptions = reportManagerNames.length > 1;
  const showTradeMarketRadar =
    reportData.weeklyRisers.some(player => player.val_now >= 2500) ||
    reportData.weeklyFallers.some(player => player.val_now >= 1800);
  const reportDeltaChanges = currentReportDeltaSnapshot
    ? buildReportDeltaChanges(
        previousReportDeltaSnapshot,
        currentReportDeltaSnapshot
      )
    : [];
  const reportFxVariant: PremiumFxVariant =
    resolvedActiveTab === "trades"
      ? "trade-flow"
      : resolvedActiveTab === "momentum"
        ? "waiver-radar"
        : resolvedActiveTab === "rankings"
          ? "rankings-grid"
          : resolvedActiveTab === "autopilot"
            ? "autopilot-orbit"
            : "report-shell";

  return (
    <>
      <Suspense fallback={<ReportDashboardChunkFallback />}>
        <ReportDashboardShell
          isLoadingRevealPhase={isLoadingRevealPhase}
          aiVoiceMode={aiVoiceMode}
          resolvedActiveTab={resolvedActiveTab}
          reportFxVariant={reportFxVariant}
          onReportTabChange={onReportTabChange}
          hasAdminPermissions={hasAdminPermissions}
          canViewAutopilotTab={canViewAutopilotTab}
          shouldShowDraftHistoryTab={shouldShowDraftHistoryTab}
          reportTabsClassName={reportTabsClassName}
          reportTabsStyle={reportTabsStyle}
          leagueName={leagueName}
          leagueFormatPills={leagueFormatPills}
          leagueLogo={leagueLogo}
          leagueLogoInitials={leagueLogoInitials}
          onHeaderLeagueClick={onHeaderLeagueClick}
          onAnalyzeAnotherLeague={onAnalyzeAnotherLeague}
          mobileLogoSrc={DYNASTY_MOBILE_REPORT_LOGO_SRC}
          headerLogoSrc={DYNASTY_REPORT_HEADER_LOGO_SRC}
          isChangeLeagueModalOpen={isChangeLeagueModalOpen}
          onChangeLeagueOpenChange={onChangeLeagueOpenChange}
          onChangeLeagueStay={() => onChangeLeagueOpenChange(false)}
          onStartOver={onStartOver}
          canOpenAdminToolsEntry={canOpenAdminToolsEntry}
          canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
          isAdminPassphraseVerifiedForSession={
            isAdminPassphraseVerifiedForSession
          }
          hasManagerViewOptions={hasManagerViewOptions}
          reportManagerNames={reportManagerNames}
          effectiveViewerManager={effectiveViewerManager}
          managerAvatars={reportData.managerAvatars}
          leagueId={leagueId}
          leagueFormat={leagueFormat}
          onAIVoiceModeChange={onAIVoiceModeChange}
          onAdminToolsClick={onAdminToolsClick}
          onAdminViewerManagerChange={onAdminViewerManagerChange}
          managerChampionships={reportData.managerChampionships}
        >
          <ReportDashboardContent
            canViewAdminDiagnostics={canViewAdminDiagnostics}
            canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
            canViewAutopilotTab={canViewAutopilotTab}
            dashboardViewerManager={dashboardViewerManager}
            isRedraftReport={isRedraftReport}
            leagueFormat={leagueFormat}
            leagueId={leagueId}
            leagueLogo={leagueLogo}
            leagueName={leagueName}
            leagueRosterScannerMode={leagueRosterScannerMode}
            leagueValueMode={leagueValueMode}
            onAnalyze={onAnalyze}
            onImportSleeperTradeCenterSnapshot={onImportSleeperTradeCenterSnapshot}
            isImportingSleeperTradeCenterSnapshot={
              isImportingSleeperTradeCenterSnapshot
            }
            onOwnerIntelSortModeChange={onOwnerIntelSortModeChange}
            onScoutLeaguemates={onScoutLeaguemates}
            ownerIntelSortMode={ownerIntelSortMode}
            ownerTitle={modeCopy.ownerTitle}
            ownerKicker={modeCopy.ownerKicker}
            previousSavedAt={currentReportDeltaSnapshot?.savedAt}
            rankingsForReport={rankingsForReport}
            rankingsQueryIsLoading={rankingsQueryIsLoading}
            reportData={reportData}
            reportDataForView={reportDataForView}
            reportDeltaChanges={reportDeltaChanges}
            resolvedActiveTab={resolvedActiveTab}
            rosterScannerFocusKey={rosterScannerFocusKey}
            rosterTitle={modeCopy.rosterTitle}
            rosterKicker={modeCopy.rosterKicker}
            setLeagueRosterScannerMode={onLeagueRosterScannerModeChange}
            showAssistantFeatureRadar={SHOW_ASSISTANT_FEATURE_RADAR}
            showTradeMarketRadar={showTradeMarketRadar}
            shouldShowDraftHistoryTab={shouldShowDraftHistoryTab}
            tradeWarKicker={modeCopy.tradeWarKicker}
            effectiveViewerManager={effectiveViewerManager}
            homePortfolioRows={homePortfolioRows}
            filteredHomePortfolioRows={filteredHomePortfolioRows}
            orderedUserLeagues={orderedUserLeagues}
            isHomePortfolioLoading={isHomePortfolioLoading}
            portfolioSearch={portfolioSearch}
            portfolioExposureFilter={portfolioExposureFilter}
            portfolioLeagueFilter={portfolioLeagueFilter}
            onPortfolioSearchChange={onPortfolioSearchChange}
            onPortfolioExposureFilterChange={onPortfolioExposureFilterChange}
            onPortfolioLeagueFilterChange={onPortfolioLeagueFilterChange}
          />
        </ReportDashboardShell>
      </Suspense>
      {homeDialogs}
    </>
  );
}
