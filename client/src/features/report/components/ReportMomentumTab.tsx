import type { ComponentType } from "react";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import type { ReportNextMoveTarget } from "@/features/report/lib/reportNextMoveBrief";
import {
  buildMomentumPreviewMetrics,
  buildRecentTransactionPreviewMetrics,
  buildCombinedTrendingPreviewMetrics,
} from "@/features/report/lib/reportOverviewPreview";
import type { ReportData } from "@shared/types";

type ReportMomentumTabProps = {
  reportData: ReportData;
  leagueValueMode: "redraft" | "dynasty";
  isRedraftReport: boolean;
  leagueId: string;
  leagueLogo: string | null;
  effectiveViewerManager: string | null;
  WaiverIntelligencePanel: ComponentType<any>;
  RecentTransactionsPanel: ComponentType<any>;
  WeeklyMomentumTable: ComponentType<any>;
  TrendingPlayersTable: ComponentType<any>;
  nextMoveTarget?: ReportNextMoveTarget | null;
};

export function ReportMomentumTab({
  reportData,
  leagueValueMode,
  isRedraftReport,
  leagueId,
  leagueLogo,
  effectiveViewerManager,
  WaiverIntelligencePanel,
  RecentTransactionsPanel,
  WeeklyMomentumTable,
  TrendingPlayersTable,
  nextMoveTarget,
}: ReportMomentumTabProps) {
  const waiverOpenSignal =
    nextMoveTarget?.sectionKey === "waiver-intelligence"
      ? nextMoveTarget.openSignal
      : 0;

  return (
    <div className="report-command-section-stack space-y-6 sm:space-y-8">
      <CollapsibleReportSection
        title="Waiver Intelligence"
        kicker={
          isRedraftReport
            ? "Waiver fits"
            : "Waiver value"
        }
        previewMetrics={buildMomentumPreviewMetrics(reportData)}
        targetKey="waiver-intelligence"
        openSignal={waiverOpenSignal}
      >
        <WaiverIntelligencePanel
          data={reportData.waiverIntelligence}
          managerAvatars={reportData.managerAvatars}
          playerDetailsById={reportData.playerDetailsById}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          viewerManager={effectiveViewerManager}
          managerRosterIntelligence={reportData.managerRosterIntelligence}
          managerPositionCounts={reportData.managerPositionCounts}
          positionDepth={reportData.positionDepth}
          leagueDiagnostics={reportData.leagueDiagnostics}
          recentTransactions={reportData.recentTransactions}
          leagueValueMode={leagueValueMode}
          scheduleEdgeTargets={reportData.scheduleEdgeTargets}
          calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title="Recent Transactions"
        kicker="Claims and drops"
        previewMetrics={buildRecentTransactionPreviewMetrics(
          reportData.recentTransactions,
          leagueValueMode
        )}
      >
        <RecentTransactionsPanel
          data={reportData.recentTransactions}
          managerAvatars={reportData.managerAvatars}
          playerDetailsById={reportData.playerDetailsById}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          leagueValueMode={leagueValueMode}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title="Market Movers"
        kicker="Value swings"
        previewMetrics={buildMomentumPreviewMetrics(reportData)}
      >
        <WeeklyMomentumTable
          data={[]}
          sections={[
            {
              title: "Top Trenders",
              data: reportData.weeklyRisers,
            },
            {
              title: "Biggest Sliders",
              data: reportData.weeklyFallers,
            },
          ]}
          title="Market Movers"
          managerAvatars={reportData.managerAvatars}
          playerDetailsById={reportData.playerDetailsById}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          viewerManager={effectiveViewerManager}
          leagueValueMode={leagueValueMode}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title="Trending"
        kicker={
          isRedraftReport
            ? "Add/drop heat"
            : "Market heat"
        }
        previewMetrics={buildCombinedTrendingPreviewMetrics(reportData)}
      >
        <TrendingPlayersTable
          data={[]}
          sections={[
            {
              title: "Top Trenders",
              countLabel: "Adds",
              data: reportData.trendingAdds || [],
            },
            {
              title: "Top Drops",
              countLabel: "Drops",
              data: reportData.trendingDrops || [],
            },
          ]}
          title="Trending"
          countLabel="Adds"
          managerAvatars={reportData.managerAvatars}
          playerDetailsById={reportData.playerDetailsById}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          viewerManager={effectiveViewerManager}
          leagueValueMode={leagueValueMode}
        />
      </CollapsibleReportSection>
    </div>
  );
}
