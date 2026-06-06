import type { ComponentType } from "react";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import type { OwnerIntelSortMode } from "@/features/report/components/OwnerIntelControls";
import type { ReportData } from "@shared/types";

type ReportRankingsTabProps = {
  reportData: ReportData;
  reportDataForView: ReportData;
  isRedraftReport: boolean;
  leagueId: string;
  leagueLogo: string | null;
  leagueValueMode: "redraft" | "dynasty";
  effectiveViewerManager: string | null;
  leagueRosterScannerMode: OwnerIntelSortMode;
  setLeagueRosterScannerMode: (nextMode: OwnerIntelSortMode) => void;
  rosterScannerFocusKey: number;
  rankingsForReport?: ReportData["rankings"];
  rankingsQueryIsLoading: boolean;
  LeagueRosterScannerModeControls: ComponentType<{
    value: OwnerIntelSortMode;
    onChange: (nextValue: OwnerIntelSortMode) => void;
  }>;
  LeagueRosterScanner: ComponentType<{
    data?: ReportData["managerRosterIntelligence"];
    managerAvatars?: ReportData["managerAvatars"];
    playerDetailsById?: ReportData["playerDetailsById"];
    leagueOverview?: ReportData["leagueOverview"];
    powerRankings?: ReportData["powerRankings"];
    dynastyTimelines?: ReportData["dynastyTimelines"];
    pickPortfolios?: ReportData["pickPortfolios"];
    draftPicks?: ReportData["draftPicks"];
    leagueId?: string;
    leagueLogo?: string | null;
    viewerManager?: string | null;
    currentStandings?: ReportData["currentStandings"];
    leagueValueMode?: ReportData["leagueValueMode"];
    focusKey?: number;
    mode?: "dynasty" | "contender" | "rebuilder" | "starter-upgrade" | "depth-fix" | "positional-need" | "playoff-push" | "waiver-leverage";
    onModeChange?: (nextMode: "dynasty" | "contender" | "rebuilder" | "starter-upgrade" | "depth-fix" | "positional-need" | "playoff-push" | "waiver-leverage") => void;
  }>;
  RankingsBoard: ComponentType<{
    rankings?: ReportData["rankings"];
    playerDetailsById?: ReportData["playerDetailsById"];
    managerAvatars?: ReportData["managerAvatars"];
    leagueId?: string;
    leagueLogo?: string | null;
    viewerManager?: string | null;
    board?: "all" | "dynasty" | "redraft" | "devy" | "draftbuzz";
    hidePicks?: boolean;
    leagueValueMode?: ReportData["leagueValueMode"];
    leagueDiagnostics?: ReportData["leagueDiagnostics"];
    calibrationProfile?: ReportData["aiCalibrationAdjustmentProfile"];
    showAIReads?: boolean;
  }>;
  RankingsMarketRead: ComponentType<{ data: ReportData }>;
};

export function ReportRankingsTab({
  reportData,
  reportDataForView,
  isRedraftReport,
  leagueId,
  leagueLogo,
  leagueValueMode,
  effectiveViewerManager,
  leagueRosterScannerMode,
  setLeagueRosterScannerMode,
  rosterScannerFocusKey,
  rankingsForReport,
  rankingsQueryIsLoading,
  LeagueRosterScannerModeControls,
  LeagueRosterScanner,
  RankingsBoard,
  RankingsMarketRead,
}: ReportRankingsTabProps) {
  return (
    <div className="report-command-section-stack space-y-6 sm:space-y-8">
      {reportData.managerRosterIntelligence?.length ? (
        <CollapsibleReportSection
          title="Scout Leaguemates"
          kicker="Manager ranks"
          openSignal={rosterScannerFocusKey}
          afterSummaryAccessory={
            !isRedraftReport ? (
              <LeagueRosterScannerModeControls
                value={leagueRosterScannerMode}
                onChange={setLeagueRosterScannerMode}
              />
            ) : undefined
          }
        >
          <LeagueRosterScanner
            data={reportData.managerRosterIntelligence}
            managerAvatars={reportData.managerAvatars}
            playerDetailsById={reportData.playerDetailsById}
            leagueOverview={reportData.leagueOverview}
            powerRankings={reportData.powerRankings}
            dynastyTimelines={reportData.dynastyTimelines}
            pickPortfolios={reportData.pickPortfolios}
            draftPicks={reportData.draftPicks}
            leagueId={leagueId}
            leagueLogo={leagueLogo}
            viewerManager={effectiveViewerManager}
            currentStandings={reportData.currentStandings}
            leagueValueMode={leagueValueMode}
            focusKey={rosterScannerFocusKey}
            mode={!isRedraftReport ? leagueRosterScannerMode : undefined}
            onModeChange={
              !isRedraftReport
                ? nextMode => {
                    if (
                      nextMode === "dynasty" ||
                      nextMode === "contender" ||
                      nextMode === "rebuilder"
                    ) {
                      setLeagueRosterScannerMode(nextMode);
                    }
                  }
                : undefined
            }
          />
        </CollapsibleReportSection>
      ) : null}
      <CollapsibleReportSection
        title="Full Roster Rankings"
        kicker={
          isRedraftReport
            ? "Season values"
            : "Player values"
        }
        defaultOpen
      >
        {rankingsQueryIsLoading && !rankingsForReport ? (
          <div className="rankings-empty-state">Loading league-matched rankings...</div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            <RankingsMarketRead data={reportDataForView} />
            <RankingsBoard
              rankings={rankingsForReport}
              playerDetailsById={reportData.playerDetailsById}
              managerAvatars={reportData.managerAvatars}
              leagueId={leagueId}
              leagueLogo={leagueLogo}
              viewerManager={effectiveViewerManager}
              board={isRedraftReport ? "redraft" : "dynasty"}
              hidePicks={isRedraftReport}
              leagueValueMode={leagueValueMode}
              leagueDiagnostics={reportData.leagueDiagnostics}
              calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
              showAIReads
            />
          </div>
        )}
      </CollapsibleReportSection>
      {!isRedraftReport && (
        <CollapsibleReportSection
          title="College Rankings"
          kicker="Rookie pipeline"
          previewAccessory={
            <span className="report-pill-shell report-inline-pill rankings-header-context-pill">
              2021-2027 Tracked
            </span>
          }
        >
          {rankingsQueryIsLoading && !rankingsForReport ? (
            <div className="rankings-empty-state">
              Loading college prospect rankings...
            </div>
          ) : (
            <RankingsBoard
              rankings={rankingsForReport}
              playerDetailsById={reportData.playerDetailsById}
              managerAvatars={reportData.managerAvatars}
              leagueId={leagueId}
              leagueLogo={leagueLogo}
              viewerManager={effectiveViewerManager}
              board="devy"
              hidePicks
              leagueValueMode={leagueValueMode}
              leagueDiagnostics={reportData.leagueDiagnostics}
              calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
              showAIReads
            />
          )}
        </CollapsibleReportSection>
      )}
    </div>
  );
}
