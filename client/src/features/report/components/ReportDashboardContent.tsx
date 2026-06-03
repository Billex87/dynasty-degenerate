import { lazy, Suspense } from "react";

import { TabsContent } from "@/components/ui/tabs";
import ErrorBoundary from "@/components/ErrorBoundary";
import { EmptyState } from "@/components/reportPrimitives";
import { ReportSectionLoadingFallback } from "@/features/report/components/ReportSectionDisclosure";
import { AutopilotErrorFallback } from "@/features/report/components/AutopilotErrorFallback";
import {
  ReportDashboardSpotlight,
  ReportOverviewHero,
} from "@/features/report/components/ReportDashboardShowcase";
import { ReportOverviewTab } from "@/features/report/components/ReportOverviewTab";
import { ReportMomentumTab } from "@/features/report/components/ReportMomentumTab";
import { ReportRankingsTab } from "@/features/report/components/ReportRankingsTab";
import { LeagueSettingsSummary } from "@/features/report/components/LeagueSettingsSummary";
import { ReportTradesTab } from "@/features/report/components/ReportTradesTab";
import {
  ReportSinceLastReportBrief,
  type ReportDeltaChange,
} from "@/features/report/components/ReportDeltaBrief";
import {
  LeagueRosterScannerModeControls,
  OwnerIntelSortControls,
  type OwnerIntelSortMode,
} from "@/features/report/components/OwnerIntelControls";
import AITeamAutopilot from "@/components/AITeamAutopilot";
import type { ReportData } from "@shared/types";
import { type LeagueValueMode } from "@/lib/leagueValueMode";
import type {
  HomeLeagueSelectionLeague,
  HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";
import type { HomePortfolioExposureFilter } from "@/features/home/lib/portfolioRows";

import { AdminDiagnosticsShell } from "@/features/admin/components/AdminDiagnosticsShell";
import { AdminScheduleEdgeSection } from "@/features/admin/components/AdminScheduleEdgeSections";

const DraftAnalysis = lazy(() =>
  import("@/components/DraftAnalysis").then(module => ({
    default: module.DraftAnalysis,
  }))
);
const RankingsBoard = lazy(() =>
  import("@/components/RankingsBoard").then(module => ({
    default: module.RankingsBoard,
  }))
);
const WeeklyMomentumTable = lazy(
  () => import("@/components/reportTables/WeeklyMomentumTable")
);
const TradeWarRoom = lazy(
  () => import("@/components/reportTables/TradeWarRoom")
);
const LeagueRosterScanner = lazy(
  () => import("@/components/reportTables/LeagueRosterScanner")
);
const TradeProfitLeaderboardTable = lazy(
  () => import("@/components/reportTables/TradeProfitLeaderboardTable")
);
const TradeHistoryTable = lazy(
  () => import("@/components/reportTables/TradeHistoryTable")
);
const TradeProposalSignalsTable = lazy(
  () => import("@/components/reportTables/TradeProposalSignalsTable")
);
const ManagerPositionCountsTable = lazy(
  () => import("@/components/reportTables/ManagerPositionCountsTable")
);
const OwnerIntelMatrix = lazy(
  () => import("@/components/reportTables/OwnerIntelMatrix")
);
const LeagueCommandCenter = lazy(
  () => import("@/components/reportTables/LeagueCommandCenter")
);
const TradeMarketRadar = lazy(
  () => import("@/components/reportTables/TradeMarketRadar")
);
const TradeTheftDetector = lazy(
  () => import("@/components/reportTables/TradeTheftDetector")
);
const TrendingPlayersTable = lazy(
  () => import("@/components/reportTables/TrendingPlayersTable")
);
const WaiverIntelligencePanel = lazy(
  () => import("@/components/reportTables/WaiverIntelligencePanel")
);
const RecentTransactionsPanel = lazy(
  () => import("@/components/reportTables/RecentTransactionsPanel")
);
const OverviewAIPulse = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.OverviewAIPulse,
  }))
);
const MonthlyTeamBlueprint = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.MonthlyTeamBlueprint,
  }))
);
const LeaguePowerRankings = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.LeaguePowerRankings,
  }))
);
const TeamBreakdownRecon = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.TeamBreakdownRecon,
  }))
);
const TradeFinderGenerator = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.TradeFinderGenerator,
  }))
);
const TradePartnerFinder = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.TradePartnerFinder,
  }))
);
const LeagueExploits = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.LeagueExploits,
  }))
);
const RankingsMarketRead = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.RankingsMarketRead,
  }))
);
const TradeBrowserRead = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.TradeBrowserRead,
  }))
);
const AssistantFeatureShells = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.AssistantFeatureShells,
  }))
);

type ReportDashboardContentProps = {
  reportData: ReportData;
  reportDataForView: ReportData;
  canViewAdminFeatureExpansion: boolean;
  canViewAdminDiagnostics: boolean;
  canViewAutopilotTab: boolean;
  shouldShowDraftHistoryTab: boolean;
  isRedraftReport: boolean;
  leagueValueMode: LeagueValueMode;
  leagueName: string;
  leagueFormat: string;
  leagueId: string;
  leagueLogo: string | null;
  resolvedActiveTab: string;
  effectiveViewerManager: string | null;
  ownerIntelSortMode: OwnerIntelSortMode;
  onOwnerIntelSortModeChange: (mode: OwnerIntelSortMode) => void;
  ownerTitle: string;
  ownerKicker: string;
  rosterTitle: string;
  rosterKicker: string;
  showAssistantFeatureRadar: boolean;
  showTradeMarketRadar: boolean;
  leagueRosterScannerMode: OwnerIntelSortMode;
  setLeagueRosterScannerMode: (mode: OwnerIntelSortMode) => void;
  rosterScannerFocusKey: number;
  rankingsForReport: ReportData["rankings"];
  rankingsQueryIsLoading: boolean;
  onAnalyze: () => void;
  onScoutLeaguemates: () => void;
  tradeWarKicker: string;
  previousSavedAt?: number | null;
  dashboardViewerManager: string | null;
  reportDeltaChanges: ReportDeltaChange[];
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
};

export function ReportDashboardContent({
  canViewAdminDiagnostics,
  canViewAdminFeatureExpansion,
  canViewAutopilotTab,
  dashboardViewerManager,
  isRedraftReport,
  leagueFormat,
  leagueId,
  leagueLogo,
  leagueName,
  leagueRosterScannerMode,
  leagueValueMode,
  onAnalyze,
  onOwnerIntelSortModeChange,
  onScoutLeaguemates,
  ownerIntelSortMode,
  ownerKicker,
  ownerTitle,
  previousSavedAt,
  rankingsForReport,
  rankingsQueryIsLoading,
  resolvedActiveTab,
  reportData,
  reportDataForView,
  reportDeltaChanges,
  rosterScannerFocusKey,
  rosterTitle,
  setLeagueRosterScannerMode,
  showAssistantFeatureRadar,
  showTradeMarketRadar,
  shouldShowDraftHistoryTab,
  tradeWarKicker,
  effectiveViewerManager,
  filteredHomePortfolioRows,
  homePortfolioRows,
  isHomePortfolioLoading,
  onPortfolioExposureFilterChange,
  onPortfolioLeagueFilterChange,
  onPortfolioSearchChange,
  orderedUserLeagues,
  portfolioExposureFilter,
  portfolioLeagueFilter,
  portfolioSearch,
  rosterKicker,
}: ReportDashboardContentProps) {
  const isPreDraftReport =
    reportData.leagueDiagnostics?.draftStatus === "pre_draft" ||
    reportData.leagueDiagnostics?.draftStatus === "drafting" ||
    (isRedraftReport &&
      reportData.leagueDiagnostics?.currentSeasonMainDraftStatus ===
        "not_started");
  const preDraftDescription =
    "Sleeper has not returned complete drafted rosters for this league yet. Use Rankings for draft planning now; team-specific grades, trade reads, and draft receipts unlock after the league drafts.";

  return (
    <div className="report-dashboard-shell">
      <main className="report-dashboard-main">
        <h1 className="sr-only">{leagueName} league report</h1>
        <div
          className="overview-command-canvas report-command-canvas"
          data-active-tab={resolvedActiveTab}
        >
          {!isPreDraftReport ? (
            <ReportOverviewHero
              leagueName={leagueName}
              activeTab={resolvedActiveTab}
              leagueValueMode={leagueValueMode}
              reportData={reportDataForView}
            />
          ) : null}
          <ReportSinceLastReportBrief
            changes={reportDeltaChanges}
            previousSavedAt={previousSavedAt}
          />
          {isPreDraftReport ? (
            <EmptyState
              className="report-pre-draft-empty-state"
              title="Draft-dependent analysis unlocks after this league drafts"
              description="Use the rankings board for current-season draft planning now. Roster grades, trade receipts, and team-specific reads stay limited until Sleeper returns drafted rosters."
            />
          ) : null}
          <Suspense fallback={<ReportSectionLoadingFallback />}>
            <TabsContent value="overview" className="report-tab-content">
              {isPreDraftReport ? (
                <div className="space-y-6">
                  <LeagueSettingsSummary
                    diagnostics={reportData.leagueDiagnostics}
                    leagueName={leagueName}
                    leagueValueMode={leagueValueMode}
                  />
                  <EmptyState
                    className="report-pre-draft-empty-state"
                    title="Roster overview unlocks after the draft"
                    description={preDraftDescription}
                  />
                </div>
              ) : (
                <ReportOverviewTab
                  reportData={reportData}
                  reportDataForView={reportDataForView}
                  canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
                  isRedraftReport={isRedraftReport}
                  leagueValueMode={leagueValueMode}
                  leagueName={leagueName}
                  leagueFormat={leagueFormat}
                  leagueId={leagueId}
                  leagueLogo={leagueLogo}
                  homePortfolioRows={homePortfolioRows}
                  filteredHomePortfolioRows={filteredHomePortfolioRows}
                  orderedUserLeagues={orderedUserLeagues}
                  isHomePortfolioLoading={isHomePortfolioLoading}
                  portfolioSearch={portfolioSearch}
                  portfolioExposureFilter={portfolioExposureFilter}
                  portfolioLeagueFilter={portfolioLeagueFilter}
                  onPortfolioSearchChange={onPortfolioSearchChange}
                  onPortfolioExposureFilterChange={
                    onPortfolioExposureFilterChange
                  }
                  onPortfolioLeagueFilterChange={onPortfolioLeagueFilterChange}
                  effectiveViewerManager={effectiveViewerManager}
                  ownerIntelSortMode={ownerIntelSortMode}
                  onOwnerIntelSortModeChange={onOwnerIntelSortModeChange}
                  ownerTitle={ownerTitle}
                  ownerKicker={ownerKicker}
                  rosterTitle={rosterTitle}
                  rosterKicker={rosterKicker}
                  showAssistantFeatureRadar={showAssistantFeatureRadar}
                  OverviewAIPulse={OverviewAIPulse}
                  MonthlyTeamBlueprint={MonthlyTeamBlueprint}
                  LeaguePowerRankings={LeaguePowerRankings}
                  TeamBreakdownRecon={TeamBreakdownRecon}
                  TradeFinderGenerator={TradeFinderGenerator}
                  TradePartnerFinder={TradePartnerFinder}
                  LeagueExploits={LeagueExploits}
                  AssistantFeatureShells={AssistantFeatureShells}
                  OwnerIntelSortControls={OwnerIntelSortControls}
                  OwnerIntelMatrix={OwnerIntelMatrix}
                  LeagueCommandCenter={LeagueCommandCenter}
                  ManagerPositionCountsTable={ManagerPositionCountsTable}
                />
              )}
            </TabsContent>

            {canViewAutopilotTab && (
              <TabsContent
                value="autopilot"
                className="report-tab-content report-command-tab-body"
              >
                <ErrorBoundary
                  fallback={(error, reset) => (
                    <AutopilotErrorFallback error={error} onRetry={reset} />
                  )}
                >
                  <AITeamAutopilot
                    reportData={reportDataForView}
                    leagueId={leagueId}
                    leagueName={leagueName}
                    leagueFormat={leagueFormat}
                    leagueValueMode={leagueValueMode}
                  />
                </ErrorBoundary>
              </TabsContent>
            )}

            <TabsContent
              value="momentum"
              className="report-tab-content report-command-tab-body"
            >
              <ReportMomentumTab
                reportData={reportData}
                leagueValueMode={leagueValueMode}
                isRedraftReport={isRedraftReport}
                leagueId={leagueId}
                leagueLogo={leagueLogo}
                effectiveViewerManager={effectiveViewerManager}
                showTradeMarketRadar={showTradeMarketRadar}
                TradeMarketRadar={TradeMarketRadar}
                WaiverIntelligencePanel={WaiverIntelligencePanel}
                RecentTransactionsPanel={RecentTransactionsPanel}
                WeeklyMomentumTable={WeeklyMomentumTable}
                TrendingPlayersTable={TrendingPlayersTable}
              />
            </TabsContent>

            <TabsContent
              value="rankings"
              className="report-tab-content report-command-tab-body"
            >
              <ReportRankingsTab
                reportData={reportData}
                reportDataForView={reportDataForView}
                canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
                canViewAdminDiagnostics={canViewAdminDiagnostics}
                isRedraftReport={isRedraftReport}
                leagueValueMode={leagueValueMode}
                leagueId={leagueId}
                leagueLogo={leagueLogo}
                effectiveViewerManager={effectiveViewerManager}
                leagueRosterScannerMode={leagueRosterScannerMode}
                setLeagueRosterScannerMode={setLeagueRosterScannerMode}
                rosterScannerFocusKey={rosterScannerFocusKey}
                rankingsForReport={rankingsForReport}
                rankingsQueryIsLoading={rankingsQueryIsLoading}
                onAnalyze={onAnalyze}
                LeagueRosterScannerModeControls={
                  LeagueRosterScannerModeControls
                }
                LeagueRosterScanner={LeagueRosterScanner}
                RankingsBoard={RankingsBoard}
                RankingsMarketRead={RankingsMarketRead}
                AdminScheduleEdgeSection={AdminScheduleEdgeSection}
                AdminDiagnosticsShell={AdminDiagnosticsShell}
              />
            </TabsContent>

            <TabsContent
              value="trades"
              className="report-tab-content report-command-tab-body"
            >
              {isPreDraftReport ? (
                <EmptyState
                  className="report-pre-draft-empty-state"
                  title="Trade reads unlock after the draft"
                  description={preDraftDescription}
                />
              ) : (
                <ReportTradesTab
                  reportData={reportData}
                  reportDataForView={reportDataForView}
                  canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
                  showManagerPersonalityIntel={canViewAdminDiagnostics}
                  onScoutLeaguemates={onScoutLeaguemates}
                  leagueId={leagueId}
                  leagueLogo={leagueLogo}
                  leagueValueMode={leagueValueMode}
                  effectiveViewerManager={effectiveViewerManager}
                  rankingsForReport={rankingsForReport}
                  tradeWarKicker={tradeWarKicker}
                  TradeBrowserRead={TradeBrowserRead}
                  TradeProposalSignalsTable={TradeProposalSignalsTable}
                  TradeWarRoom={TradeWarRoom}
                  TradeProfitLeaderboardTable={TradeProfitLeaderboardTable}
                  TradeTheftDetector={TradeTheftDetector}
                  TradeHistoryTable={TradeHistoryTable}
                />
              )}
            </TabsContent>

            {shouldShowDraftHistoryTab && (
              <TabsContent
                value="draft"
                className="report-tab-content report-command-tab-body"
              >
                {isPreDraftReport ? (
                  <EmptyState
                    className="report-pre-draft-empty-state"
                    title="Draft receipts unlock after the draft"
                    description={preDraftDescription}
                  />
                ) : (
                  <DraftAnalysis
                    draftPicks={reportData.draftPicks || []}
                    draftStats={reportData.draftStats || []}
                    managerRosterIntelligence={
                      reportData.managerRosterIntelligence
                    }
                    managerAvatars={reportData.managerAvatars}
                    playerDetailsById={reportData.playerDetailsById}
                    leagueId={leagueId}
                    leagueLogo={leagueLogo}
                    viewerManager={effectiveViewerManager}
                    currentStandings={reportData.currentStandings}
                    leagueOverview={reportData.leagueOverview}
                    leagueValueMode={leagueValueMode}
                    leagueDiagnostics={reportData.leagueDiagnostics}
                    calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
                    showAIReads={canViewAdminFeatureExpansion}
                  />
                )}
              </TabsContent>
            )}
          </Suspense>
          {!isPreDraftReport ? (
            <ReportDashboardSpotlight
              manager={dashboardViewerManager}
              activeTab={resolvedActiveTab}
              leagueValueMode={leagueValueMode}
              reportData={reportDataForView}
              managerAvatars={reportData.managerAvatars}
              variant="inline"
            />
          ) : null}
        </div>
      </main>
      {!isPreDraftReport ? (
        <ReportDashboardSpotlight
          manager={dashboardViewerManager}
          activeTab={resolvedActiveTab}
          leagueValueMode={leagueValueMode}
          reportData={reportDataForView}
          managerAvatars={reportData.managerAvatars}
        />
      ) : null}
    </div>
  );
}
