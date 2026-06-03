import type { ComponentType } from "react";
import { Layers2, Shield, Users } from "lucide-react";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import {
  buildManagerPositionRoomPreviewMetrics,
  buildOwnerIntelPreviewMetrics,
  buildRosterPreviewMetrics,
  buildTaxiPreviewMetrics,
} from "@/features/report/lib/reportOverviewPreview";
import type { OwnerIntelSortMode } from "@/features/report/components/OwnerIntelControls";
import type { ReportData } from "@shared/types";
import {
  HomePortfolioPanel,
  type HomeLeagueSelectionLeague,
  type HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";
import type { HomePortfolioExposureFilter } from "@/features/home/lib/portfolioRows";

type ReportOverviewTabProps = {
  reportData: ReportData;
  reportDataForView: ReportData;
  canViewAdminFeatureExpansion: boolean;
  isRedraftReport: boolean;
  leagueValueMode: "redraft" | "dynasty";
  leagueName: string;
  leagueFormat: string;
  leagueId: string;
  leagueLogo: string | null;
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
  effectiveViewerManager: string | null;
  ownerIntelSortMode: OwnerIntelSortMode;
  onOwnerIntelSortModeChange: (nextMode: OwnerIntelSortMode) => void;
  ownerTitle: string;
  ownerKicker: string;
  rosterTitle: string;
  rosterKicker: string;
  showAssistantFeatureRadar: boolean;
  OverviewAIPulse: ComponentType<{ data: ReportData }>;
  MonthlyTeamBlueprint: ComponentType<{
    data: ReportData;
    leagueName: string;
    leagueFormat?: string;
    managerAvatars?: ReportData["managerAvatars"];
  }>;
  LeaguePowerRankings: ComponentType<{
    data: ReportData;
    managerAvatars?: ReportData["managerAvatars"];
  }>;
  TeamBreakdownRecon: ComponentType<{
    data: ReportData;
    managerAvatars?: ReportData["managerAvatars"];
  }>;
  TradeFinderGenerator: ComponentType<{ data: ReportData }>;
  TradePartnerFinder: ComponentType<{
    data: ReportData;
    managerAvatars?: ReportData["managerAvatars"];
  }>;
  LeagueExploits: ComponentType<{
    data: ReportData;
    managerAvatars?: ReportData["managerAvatars"];
  }>;
  AssistantFeatureShells: ComponentType<{
    data: ReportData;
    leagueName?: string;
    leagueId?: string;
  }>;
  OwnerIntelSortControls: ComponentType<{
    value: OwnerIntelSortMode;
    onChange: (nextMode: OwnerIntelSortMode) => void;
  }>;
  OwnerIntelMatrix: ComponentType<{
    data: ReportData;
    managerAvatars?: ReportData["managerAvatars"];
    leagueId?: string;
    leagueLogo?: string | null;
    viewerManager?: string | null;
    currentStandings?: ReportData["currentStandings"];
    leagueValueMode?: ReportData["leagueValueMode"];
    ownerIntelSortMode?: OwnerIntelSortMode;
  }>;
  LeagueCommandCenter: ComponentType<{
    data: ReportData;
    managerAvatars?: ReportData["managerAvatars"];
    leagueId?: string;
    leagueLogo?: string | null;
    section?: "all" | "roster" | "taxi";
    viewerManager?: string | null;
    currentStandings?: ReportData["currentStandings"];
    leagueValueMode?: ReportData["leagueValueMode"];
  }>;
  ManagerPositionCountsTable: ComponentType<{
    data: ReportData["managerPositionCounts"];
    positionDepth?: ReportData["positionDepth"];
    managerAvatars?: ReportData["managerAvatars"];
    playerDetailsById?: ReportData["playerDetailsById"];
    leagueId?: string;
    leagueLogo?: string | null;
    viewerManager?: string | null;
    leagueValueMode?: ReportData["leagueValueMode"];
  }>;
};

export function ReportOverviewTab({
  reportData,
  reportDataForView,
  canViewAdminFeatureExpansion,
  isRedraftReport,
  leagueValueMode,
  leagueName,
  leagueFormat,
  leagueId,
  leagueLogo,
  homePortfolioRows,
  filteredHomePortfolioRows,
  orderedUserLeagues,
  isHomePortfolioLoading,
  portfolioSearch,
  portfolioExposureFilter,
  portfolioLeagueFilter,
  onPortfolioSearchChange,
  onPortfolioExposureFilterChange,
  onPortfolioLeagueFilterChange,
  effectiveViewerManager,
  ownerIntelSortMode,
  onOwnerIntelSortModeChange,
  ownerTitle,
  ownerKicker,
  rosterTitle,
  rosterKicker,
  showAssistantFeatureRadar,
  OverviewAIPulse,
  MonthlyTeamBlueprint,
  LeaguePowerRankings,
  TeamBreakdownRecon,
  TradeFinderGenerator,
  TradePartnerFinder,
  LeagueExploits,
  AssistantFeatureShells,
  OwnerIntelSortControls,
  OwnerIntelMatrix,
  LeagueCommandCenter,
  ManagerPositionCountsTable,
}: ReportOverviewTabProps) {
  const hasTaxiTriage =
    !isRedraftReport &&
    reportData.managerRosterIntelligence?.some(
      row => (row.taxiTriage?.items.length || 0) > 0
    );
  const portfolioOverlapCount = homePortfolioRows.filter(
    row => row.leagueCount > 1
  ).length;
  const playerHoardSection = orderedUserLeagues.length > 0 ? (
    <CollapsibleReportSection
      title="Cross League Exposure"
      kicker="Roster overlap and stash risk across every saved league"
      previewAccessory={
        <span className="home-portfolio-open-chip">Open portfolio</span>
      }
      previewMetrics={[
        {
          label: "Players",
          compactLabel: "Ply",
          icon: <Users size={13} />,
          value: homePortfolioRows.length || 0,
          tone: homePortfolioRows.length ? "info" : "neutral",
          className: "home-portfolio-preview-chip",
        },
        {
          label: "Overlap",
          compactLabel: "Dup",
          icon: <Layers2 size={13} />,
          value: portfolioOverlapCount,
          tone: portfolioOverlapCount ? "warn" : "neutral",
          className: "home-portfolio-preview-chip",
        },
        {
          label: "Leagues",
          compactLabel: "Lg",
          icon: <Shield size={13} />,
          value: orderedUserLeagues.length,
          tone: orderedUserLeagues.length > 1 ? "good" : "neutral",
          className: "home-portfolio-preview-chip",
        },
      ]}
    >
      <HomePortfolioPanel
        rows={homePortfolioRows}
        filteredRows={filteredHomePortfolioRows}
        leagues={orderedUserLeagues}
        isLoading={isHomePortfolioLoading}
        query={portfolioSearch}
        exposureFilter={portfolioExposureFilter}
        selectedLeagueId={portfolioLeagueFilter}
        onQueryChange={onPortfolioSearchChange}
        onExposureFilterChange={onPortfolioExposureFilterChange}
        onLeagueFilterChange={onPortfolioLeagueFilterChange}
        showLeagueChooser={false}
        className="home-portfolio-shell-report"
      />
    </CollapsibleReportSection>
  ) : null;

  return (
    <div className="dashboard-overview-section-stack space-y-6 sm:space-y-8">
      {canViewAdminFeatureExpansion && (
        <>
          <OverviewAIPulse data={reportDataForView} />
          {playerHoardSection}
          <CollapsibleReportSection
            title="Monthly Team Blueprint"
            kicker="Monthly direction, roster age, and plan cadence"
            premium
            previewMetrics={[
              {
                label: "Cadence",
                value: "Monthly",
                tone: "neutral",
              },
              {
                label: "Plan Lens",
                value: isRedraftReport ? "Season" : "Dynasty",
                tone: "neutral",
              },
              {
                label: "Snapshot",
                value: reportData.weeklyRisers?.length ? "Partial" : "Current",
                tone: reportData.weeklyRisers?.length ? "info" : "warn",
              },
            ]}
          >
            <MonthlyTeamBlueprint
              data={reportDataForView}
              leagueName={leagueName}
              leagueFormat={leagueFormat}
              managerAvatars={reportData.managerAvatars}
            />
          </CollapsibleReportSection>
          <CollapsibleReportSection
            title="League Power Rankings"
            kicker={
              isRedraftReport
                ? "Weekly league ordering and relative strength tiers"
                : "League ordering, value tiers, and relative strength"
            }
            premium
            previewMetrics={[
              {
                label: "Ranked Teams",
                compactLabel: "Teams",
                value: reportData.powerRankings?.length || 0,
                tone: reportData.powerRankings?.length ? "info" : "warn",
              },
              {
                label: "Ordering",
                value: "Power",
                tone: "neutral",
              },
              {
                label: "Lens",
                value: isRedraftReport ? "Weekly" : "Dynasty",
                tone: "neutral",
              },
            ]}
          >
            <LeaguePowerRankings
              data={reportDataForView}
              managerAvatars={reportData.managerAvatars}
            />
          </CollapsibleReportSection>
          <CollapsibleReportSection
            title="Team Breakdown & Roster Recon"
            kicker="Per-roster strengths, leaks, surplus, and next move"
            premium
            previewMetrics={[
              {
                label: "Scope",
                value: "Team-by-team",
                tone: "neutral",
              },
              {
                label: "Recon Rows",
                compactLabel: "Rows",
                value: reportData.managerRosterIntelligence?.length || 0,
                tone: reportData.managerRosterIntelligence?.length ? "info" : "warn",
              },
              {
                label: "Flag Source",
                compactLabel: "Flags",
                value: reportData.positionDepth?.length || 0,
                tone: reportData.positionDepth?.length ? "warn" : "neutral",
              },
            ]}
          >
            <TeamBreakdownRecon
              data={reportDataForView}
              managerAvatars={reportData.managerAvatars}
            />
          </CollapsibleReportSection>
          <CollapsibleReportSection
            title="Trade Finder"
            kicker={
              isRedraftReport
                ? "Trade partners, upgrade lanes, and weekly pressure points"
                : "Trade partners, package lanes, and league pressure points"
            }
            premium
            previewMetrics={[
              {
                label: "Owner",
                value: "Trade market",
                tone: "neutral",
              },
              {
                label: "Inputs",
                value: isRedraftReport ? "Needs/Fits" : "Needs/Picks",
                tone: "info",
              },
              {
                label: isRedraftReport ? "Fit Rows" : "Pick Rows",
                value: isRedraftReport
                  ? reportData.managerRosterIntelligence?.length || 0
                  : reportData.pickPortfolios?.length || 0,
                tone: isRedraftReport
                  ? reportData.managerRosterIntelligence?.length
                    ? "info"
                    : "warn"
                  : reportData.pickPortfolios?.length
                    ? "info"
                    : "warn",
              },
            ]}
          >
            <div className="command-expansion-stack">
              <TradeFinderGenerator data={reportDataForView} />
              <TradePartnerFinder
                data={reportDataForView}
                managerAvatars={reportData.managerAvatars}
              />
              <LeagueExploits
                data={reportDataForView}
                managerAvatars={reportData.managerAvatars}
              />
            </div>
          </CollapsibleReportSection>
          {showAssistantFeatureRadar && (
            <CollapsibleReportSection
              title="Assistant Feature Radar"
              kicker="Useful shells without fake data"
              premium
              previewMetrics={[
                {
                  label: "Status",
                  value: "Shells",
                  tone: "neutral",
                },
                {
                  label: "Data",
                  value: "No fake reads",
                  tone: "info",
                },
                {
                  label: "Mode",
                  value: "Inventory",
                  tone: "neutral",
                },
              ]}
            >
              <AssistantFeatureShells
                data={reportDataForView}
                leagueName={leagueName}
                leagueId={leagueId}
              />
            </CollapsibleReportSection>
          )}
        </>
      )}
      {!canViewAdminFeatureExpansion ? playerHoardSection : null}
      <CollapsibleReportSection
        title={ownerTitle}
        kicker={ownerKicker}
        defaultOpen
        previewAccessory={
          !isRedraftReport ? (
            <OwnerIntelSortControls
              value={ownerIntelSortMode}
              onChange={onOwnerIntelSortModeChange}
            />
          ) : undefined
        }
        previewMetrics={
          !isRedraftReport
            ? buildOwnerIntelPreviewMetrics(reportDataForView, ownerIntelSortMode)
            : undefined
        }
      >
        <OwnerIntelMatrix
          data={reportDataForView}
          managerAvatars={reportData.managerAvatars}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          viewerManager={effectiveViewerManager}
          currentStandings={reportData.currentStandings}
          leagueValueMode={leagueValueMode}
          ownerIntelSortMode={ownerIntelSortMode}
        />
      </CollapsibleReportSection>
      <CollapsibleReportSection
        title={rosterTitle}
        kicker={rosterKicker}
        defaultOpen
        previewMetrics={buildRosterPreviewMetrics(reportData)}
      >
        <LeagueCommandCenter
          data={reportDataForView}
          managerAvatars={reportData.managerAvatars}
          leagueId={leagueId}
          leagueLogo={leagueLogo}
          section="roster"
          viewerManager={effectiveViewerManager}
          currentStandings={reportData.currentStandings}
          leagueValueMode={leagueValueMode}
        />
      </CollapsibleReportSection>
      {hasTaxiTriage && (
        <CollapsibleReportSection
          title="Taxi Squad Triage"
          kicker="Taxi-only activation checks"
          defaultOpen
          previewMetrics={buildTaxiPreviewMetrics(reportData)}
        >
          <LeagueCommandCenter
            data={reportDataForView}
            managerAvatars={reportData.managerAvatars}
            leagueId={leagueId}
            leagueLogo={leagueLogo}
            section="taxi"
            viewerManager={effectiveViewerManager}
            currentStandings={reportData.currentStandings}
          />
        </CollapsibleReportSection>
      )}
      {reportData.managerPositionCounts.length > 0 && (
        <CollapsibleReportSection
          title="Manager Position Counts"
          kicker={
            isRedraftReport
              ? "Starter depth and position gaps"
              : "Full roster depth map"
          }
          defaultOpen
          previewMetrics={buildManagerPositionRoomPreviewMetrics(reportData)}
        >
          <ManagerPositionCountsTable
            data={reportData.managerPositionCounts}
            positionDepth={reportData.positionDepth}
            managerAvatars={reportData.managerAvatars}
            playerDetailsById={reportData.playerDetailsById}
            leagueId={leagueId}
            leagueLogo={leagueLogo}
            viewerManager={effectiveViewerManager}
            leagueValueMode={leagueValueMode}
          />
        </CollapsibleReportSection>
      )}
    </div>
  );
}
