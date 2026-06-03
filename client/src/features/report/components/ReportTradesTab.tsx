import type { ComponentType } from "react";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { ModalReportSection } from "@/features/report/components/ReportSectionDisclosure";
import type { ReportData } from "@shared/types";
import { buildMomentumPreviewMetrics } from "@/features/report/lib/reportOverviewPreview";
import { buildTradeProposalPreviewMetrics } from "@/features/report/lib/reportOverviewPreview";
import { buildTradePreviewMetrics } from "@/features/report/lib/reportOverviewPreview";

type ReportTradesTabProps = {
  reportData: ReportData;
  reportDataForView: ReportData;
  canViewAdminFeatureExpansion: boolean;
  showManagerPersonalityIntel: boolean;
  onScoutLeaguemates: () => void;
  leagueId: string;
  leagueLogo: string | null;
  leagueValueMode: "redraft" | "dynasty";
  effectiveViewerManager: string | null;
  rankingsForReport?: ReportData["rankings"];
  tradeWarKicker: string;
  showTradeMarketRadar: boolean;
  TradeBrowserRead: ComponentType<{ data: ReportData }>;
  TradeMarketRadar: ComponentType<any>;
  TradeProposalSignalsTable: ComponentType<{
    data: NonNullable<ReportData["tradeProposalSignals"]>;
    managerAvatars?: ReportData["managerAvatars"];
  }>;
  TradeWarRoom: ComponentType<{
    data?: ReportData["managerRosterIntelligence"];
    managerAvatars?: ReportData["managerAvatars"];
    playerDetailsById?: ReportData["playerDetailsById"];
    leagueId?: string;
    leagueLogo?: string | null;
    leagueOverview?: ReportData["leagueOverview"];
    rankings?: ReportData["rankings"];
    pickPortfolios?: ReportData["pickPortfolios"];
    draftPicks?: ReportData["draftPicks"];
    tradeTendencies?: ReportData["tradeTendencies"];
    tradeProposalSignals?: ReportData["tradeProposalSignals"];
    recentTransactions?: ReportData["recentTransactions"];
    showManagerPersonalityIntel?: boolean;
    viewerManager?: string | null;
    currentStandings?: ReportData["currentStandings"];
    leagueValueMode?: ReportData["leagueValueMode"];
    onScoutLeaguemates?: () => void;
  }>;
  TradeProfitLeaderboardTable: ComponentType<{
    data: ReportData["tradeProfitLeaderboard"];
    managerAvatars?: ReportData["managerAvatars"];
    tradeHistory?: ReportData["tradeHistory"];
    draftPicks?: ReportData["draftPicks"];
    playerDetailsById: ReportData["playerDetailsById"];
    currentPositionRankById?: ReportData["currentPositionRankById"];
    tradeTendencies?: ReportData["tradeTendencies"];
    managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
    dynastyTimelines?: ReportData["dynastyTimelines"];
    leagueOverview?: ReportData["leagueOverview"];
    leagueId?: string;
    leagueLogo?: string | null;
    viewerManager?: string | null;
    leagueDiagnostics?: ReportData["leagueDiagnostics"];
    currentStandings?: ReportData["currentStandings"];
    standingsHistory?: ReportData["standingsHistory"];
    leagueValueMode?: ReportData["leagueValueMode"];
  }>;
  TradeTheftDetector: ComponentType<{
    data: ReportData["tradeHistory"];
    managerAvatars?: ReportData["managerAvatars"];
    draftPicks?: ReportData["draftPicks"];
    playerDetailsById: ReportData["playerDetailsById"];
    currentPositionRankById?: ReportData["currentPositionRankById"];
    managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
    dynastyTimelines?: ReportData["dynastyTimelines"];
    leagueOverview?: ReportData["leagueOverview"];
    leagueId?: string;
    leagueLogo?: string | null;
    leagueDiagnostics?: ReportData["leagueDiagnostics"];
    currentStandings?: ReportData["currentStandings"];
    standingsHistory?: ReportData["standingsHistory"];
    leagueValueMode?: ReportData["leagueValueMode"];
  }>;
  TradeHistoryTable: ComponentType<{
    data: ReportData["tradeHistory"];
    draftPicks?: ReportData["draftPicks"];
    managerAvatars?: ReportData["managerAvatars"];
    playerDetailsById: ReportData["playerDetailsById"];
    currentPositionRankById?: ReportData["currentPositionRankById"];
    managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
    dynastyTimelines?: ReportData["dynastyTimelines"];
    leagueOverview?: ReportData["leagueOverview"];
    leagueId?: string;
    leagueLogo?: string | null;
    leagueDiagnostics?: ReportData["leagueDiagnostics"];
    currentStandings?: ReportData["currentStandings"];
    standingsHistory?: ReportData["standingsHistory"];
    leagueValueMode?: ReportData["leagueValueMode"];
    variant?: "inline" | "modal";
  }>;
};

export function ReportTradesTab({
  reportData,
  reportDataForView,
  canViewAdminFeatureExpansion,
  showManagerPersonalityIntel,
  onScoutLeaguemates,
  leagueId,
  leagueLogo,
  leagueValueMode,
  effectiveViewerManager,
  rankingsForReport,
  tradeWarKicker,
  showTradeMarketRadar,
  TradeBrowserRead,
  TradeMarketRadar,
  TradeProposalSignalsTable,
  TradeWarRoom,
  TradeProfitLeaderboardTable,
  TradeTheftDetector,
  TradeHistoryTable,
}: ReportTradesTabProps) {
  return (
    <div className="trade-sections report-command-section-stack space-y-6 sm:space-y-8">
      {showTradeMarketRadar && (
        <CollapsibleReportSection
          title="Trade Market Radar"
          kicker={
            leagueValueMode === "redraft"
              ? "Current-season buy and sell signals"
              : "Buy and sell signals"
          }
          previewMetrics={buildMomentumPreviewMetrics(reportData)}
        >
          <TradeMarketRadar
            risers={reportData.weeklyRisers}
            fallers={reportData.weeklyFallers}
            managerAvatars={reportData.managerAvatars}
            playerDetailsById={reportData.playerDetailsById}
            leagueId={leagueId}
            leagueLogo={leagueLogo}
            viewerManager={effectiveViewerManager}
            leagueValueMode={leagueValueMode}
          />
        </CollapsibleReportSection>
      )}
      {canViewAdminFeatureExpansion && <TradeBrowserRead data={reportDataForView} />}
      {canViewAdminFeatureExpansion && (
        <CollapsibleReportSection
          title="Pending Trade Offers"
          kicker="Pending, declined, rejected, and cancelled Sleeper transactions"
          previewMetrics={buildTradeProposalPreviewMetrics(reportData)}
          premium
          defaultOpen
        >
          <TradeProposalSignalsTable
            data={
              reportData.adminTradeProposalSignals ||
              reportData.tradeProposalSignals ||
              []
            }
            managerAvatars={reportData.managerAvatars}
          />
        </CollapsibleReportSection>
      )}
      <CollapsibleReportSection
        title="Trade War Room"
        kicker={tradeWarKicker}
        previewMetrics={buildTradePreviewMetrics(
          reportData,
          leagueValueMode,
          "war-room"
        )}
      >
          <TradeWarRoom
            data={reportData.managerRosterIntelligence}
          managerAvatars={reportData.managerAvatars}
          playerDetailsById={reportData.playerDetailsById}
          leagueOverview={reportData.leagueOverview}
          rankings={rankingsForReport || undefined}
            pickPortfolios={reportData.pickPortfolios}
          draftPicks={reportData.draftPicks}
          tradeTendencies={reportData.tradeTendencies}
          tradeProposalSignals={[
            ...(reportData.tradeProposalSignals || []),
            ...(reportData.adminTradeProposalSignals || []),
            ...(reportData.adminSleeperTradeProposalSignals || []),
          ]}
          recentTransactions={reportData.recentTransactions}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          viewerManager={effectiveViewerManager}
          currentStandings={reportData.currentStandings}
          leagueValueMode={leagueValueMode}
          showManagerPersonalityIntel={showManagerPersonalityIntel}
          onScoutLeaguemates={onScoutLeaguemates}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title={
          leagueValueMode === "redraft"
            ? "Trade Value Board"
            : "Trade Profit Board"
        }
        kicker={
          leagueValueMode === "redraft"
            ? "Current-season trade edge"
            : "Net trade edge"
        }
        previewMetrics={buildTradePreviewMetrics(
          reportData,
          leagueValueMode,
          "leaderboard"
        )}
      >
        <TradeProfitLeaderboardTable
          data={reportData.tradeProfitLeaderboard}
          managerAvatars={reportData.managerAvatars}
          tradeHistory={reportData.tradeHistory}
          draftPicks={reportData.draftPicks || []}
          playerDetailsById={reportData.playerDetailsById}
          currentPositionRankById={reportData.currentPositionRankById}
          tradeTendencies={reportData.tradeTendencies}
          managerRosterIntelligence={reportData.managerRosterIntelligence}
          dynastyTimelines={reportData.dynastyTimelines}
          leagueOverview={reportData.leagueOverview}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          viewerManager={effectiveViewerManager}
          leagueDiagnostics={reportData.leagueDiagnostics}
          currentStandings={reportData.currentStandings}
          standingsHistory={reportData.standingsHistory}
          leagueValueMode={leagueValueMode}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title={
          leagueValueMode === "redraft"
            ? "Trade Balance Review"
            : "Trade Theft Detector"
        }
        kicker={
          leagueValueMode === "redraft"
            ? "Largest current-season gaps"
            : "Who got cooked"
        }
        previewMetrics={buildTradePreviewMetrics(
          reportData,
          leagueValueMode,
          "theft"
        )}
      >
        <TradeTheftDetector
          data={reportData.tradeHistory}
          managerAvatars={reportData.managerAvatars}
          draftPicks={reportData.draftPicks || []}
          playerDetailsById={reportData.playerDetailsById}
          currentPositionRankById={reportData.currentPositionRankById}
          managerRosterIntelligence={reportData.managerRosterIntelligence}
          dynastyTimelines={reportData.dynastyTimelines}
          leagueOverview={reportData.leagueOverview}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          leagueDiagnostics={reportData.leagueDiagnostics}
          currentStandings={reportData.currentStandings}
          standingsHistory={reportData.standingsHistory}
          leagueValueMode={leagueValueMode}
        />
      </CollapsibleReportSection>
      <ModalReportSection
        title="Trade Receipts"
        kicker="Every completed trade"
        previewMetrics={buildTradePreviewMetrics(
          reportData,
          leagueValueMode,
          "ledger"
        )}
      >
        <TradeHistoryTable
          data={reportData.tradeHistory}
          draftPicks={reportData.draftPicks || []}
          managerAvatars={reportData.managerAvatars}
          playerDetailsById={reportData.playerDetailsById}
          currentPositionRankById={reportData.currentPositionRankById}
          managerRosterIntelligence={reportData.managerRosterIntelligence}
          dynastyTimelines={reportData.dynastyTimelines}
          leagueOverview={reportData.leagueOverview}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          leagueDiagnostics={reportData.leagueDiagnostics}
          currentStandings={reportData.currentStandings}
          standingsHistory={reportData.standingsHistory}
          leagueValueMode={leagueValueMode}
          variant="modal"
        />
      </ModalReportSection>
    </div>
  );
}
