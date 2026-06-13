import { useMemo, type ComponentType } from "react";
import { ReportSkeleton } from "@/components/reportPrimitives";
import { CollapsibleReportSection } from "@/features/report/components/ReportSectionDisclosure";
import { ReportMotionSectionStack } from "@/features/report/components/ReportMotionSectionStack";
import { TeamProfileRadar, hasTeamProfileRadarData } from "@/features/report/components/TeamProfileRadar";
import { HeadToHeadTug } from "@/features/report/components/HeadToHeadTug";
import type { OwnerIntelSortMode } from "@/features/report/components/OwnerIntelControls";
import type { ReportNextMoveTarget } from "@/features/report/lib/reportNextMoveBrief";
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
  showReportAIReads: boolean;
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
  nextMoveTarget?: ReportNextMoveTarget | null;
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
  showReportAIReads,
  LeagueRosterScannerModeControls,
  LeagueRosterScanner,
  RankingsBoard,
  RankingsMarketRead,
  nextMoveTarget,
}: ReportRankingsTabProps) {
  const scoutOpenSignal =
    nextMoveTarget?.sectionKey === "scout-leaguemates"
      ? nextMoveTarget.openSignal
      : rosterScannerFocusKey;
  const fullRankingsOpenSignal =
    nextMoveTarget?.sectionKey === "full-roster-rankings"
      ? nextMoveTarget.openSignal
      : 0;
  const hasTeamProfileInputs = useMemo(
    () =>
      hasTeamProfileRadarData({
        reportData,
        viewerManager: effectiveViewerManager,
        leagueValueMode,
      }),
    [effectiveViewerManager, leagueValueMode, reportData]
  );

  return (
    <ReportMotionSectionStack className="report-command-section-stack space-y-6 sm:space-y-8">
      {hasTeamProfileInputs ? (
        <CollapsibleReportSection
          title="Team Profile"
          kicker="Blueprint radar"
          targetKey="team-profile"
        >
          <TeamProfileRadar
            reportData={reportData}
            viewerManager={effectiveViewerManager}
            leagueValueMode={leagueValueMode}
          />
        </CollapsibleReportSection>
      ) : null}
      {reportData.managerRosterIntelligence?.length ? (
        <CollapsibleReportSection
          title="Scout Leaguemates"
          kicker="Manager ranks"
          targetKey="scout-leaguemates"
          openSignal={scoutOpenSignal}
          afterSummaryAccessory={
            !isRedraftReport ? (
              <LeagueRosterScannerModeControls
                value={leagueRosterScannerMode}
                onChange={setLeagueRosterScannerMode}
              />
            ) : undefined
          }
        >
          <HeadToHeadTug
            reportData={reportData}
            viewerManager={effectiveViewerManager}
          />
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
        targetKey="full-roster-rankings"
        openSignal={fullRankingsOpenSignal}
      >
        {rankingsQueryIsLoading && !rankingsForReport ? (
          <ReportSkeleton variant="table" rows={7} />
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
              showAIReads={showReportAIReads}
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
            <ReportSkeleton variant="table" rows={7} />
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
              showAIReads={showReportAIReads}
            />
          )}
        </CollapsibleReportSection>
      )}
    </ReportMotionSectionStack>
  );
}
