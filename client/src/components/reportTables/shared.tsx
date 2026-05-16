import type { ReportData } from "@shared/types";
import { getPositionRankPillClass } from "@/lib/positionRank";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import type { PlayerModalData } from "../PlayerDetailModal";

export type ManagerAvatars = ReportData["managerAvatars"];
export type PlayerDetailsById = ReportData["playerDetailsById"];

export function formatCompactValue(value: number | null | undefined): string {
  if (!value) return "-";
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}K`;
  return value.toLocaleString();
}

export function PositionRankPill({ rank }: { rank?: string | null }) {
  const displayRank = rank || "-";
  return (
    <span className={getPositionRankPillClass(displayRank)}>{displayRank}</span>
  );
}

export function buildPlayerModalData({
  playerId,
  playerName,
  playerPos,
  value,
  valueGain,
  playerDetailsById,
  playerDetails,
  manager,
  managerAvatarUrl,
  valueChangeNote,
  currentPositionRank,
  valueMode = "dynasty",
  taxiAction,
  taxiReason,
}: {
  playerId?: string;
  playerName: string;
  playerPos?: string;
  value?: number | null;
  valueGain?: number | null;
  playerDetailsById?: PlayerDetailsById;
  playerDetails?: PlayerModalData["playerDetails"];
  manager?: string | null;
  managerAvatarUrl?: string | null;
  valueChangeNote?: string;
  currentPositionRank?: string | null;
  valueMode?: ReportData["leagueValueMode"];
  taxiAction?: string | null;
  taxiReason?: string | null;
}): PlayerModalData {
  const normalizedValueMode = normalizeLeagueValueMode(valueMode);
  const mappedDetails = playerId ? playerDetailsById?.[playerId] : undefined;
  const details = playerDetails
    ? {
        ...mappedDetails,
        ...playerDetails,
        valueProfile: playerDetails.valueProfile || mappedDetails?.valueProfile,
        lastSeasonPositionRank:
          playerDetails.lastSeasonPositionRank ||
          mappedDetails?.lastSeasonPositionRank,
        lastSeasonFantasyPoints:
          playerDetails.lastSeasonFantasyPoints ??
          mappedDetails?.lastSeasonFantasyPoints,
        lastSeasonGames:
          playerDetails.lastSeasonGames ?? mappedDetails?.lastSeasonGames,
        lastSeasonPointsPerGame:
          playerDetails.lastSeasonPointsPerGame ??
          mappedDetails?.lastSeasonPointsPerGame,
        lastSeasonYear:
          playerDetails.lastSeasonYear || mappedDetails?.lastSeasonYear,
        availabilityHistory: playerDetails.availabilityHistory?.length
          ? playerDetails.availabilityHistory
          : mappedDetails?.availabilityHistory,
        latestNews: playerDetails.latestNews || mappedDetails?.latestNews,
        avgGamesMissed:
          playerDetails.avgGamesMissed ?? mappedDetails?.avgGamesMissed,
        availabilitySeasons:
          playerDetails.availabilitySeasons ??
          mappedDetails?.availabilitySeasons,
        similarTradeValues:
          playerDetails.similarTradeValues || mappedDetails?.similarTradeValues,
        rosterStatus: playerDetails.rosterStatus || mappedDetails?.rosterStatus,
        displayStatus:
          (playerDetails.rosterStatus
            ? playerDetails.displayStatus
            : mappedDetails?.displayStatus) || playerDetails.displayStatus,
        depthChartPosition: mappedDetails?.depthChartVerified
          ? mappedDetails.depthChartPosition
          : (playerDetails.depthChartPosition ??
            mappedDetails?.depthChartPosition),
        depthChartOrder: mappedDetails?.depthChartVerified
          ? mappedDetails.depthChartOrder
          : (playerDetails.depthChartOrder ?? mappedDetails?.depthChartOrder),
        sleeperDepthChartPosition:
          mappedDetails?.sleeperDepthChartPosition ??
          playerDetails.sleeperDepthChartPosition,
        sleeperDepthChartOrder:
          mappedDetails?.sleeperDepthChartOrder ??
          playerDetails.sleeperDepthChartOrder,
        depthChartVerified:
          mappedDetails?.depthChartVerified ?? playerDetails.depthChartVerified,
        depthChartMismatch:
          mappedDetails?.depthChartMismatch ?? playerDetails.depthChartMismatch,
      }
    : mappedDetails;
  const profileRank =
    normalizedValueMode === "redraft"
      ? details?.valueProfile?.seasonPositionRank ||
        details?.valueProfile?.fantasyProsPositionRank ||
        details?.valueProfile?.dynastyPositionRank
      : details?.valueProfile?.dynastyPositionRank ||
        details?.valueProfile?.balancedPositionRank ||
        details?.valueProfile?.seasonPositionRank;
  return {
    player_id: playerId,
    playerName,
    playerPos: playerPos || details?.position,
    manager: manager || undefined,
    managerAvatarUrl,
    currentPositionRank: currentPositionRank || profileRank || null,
    currentKtcValue: value ?? undefined,
    valueGain: valueGain ?? undefined,
    playerDetails: details,
    valueChangeNote,
    valueMode: normalizedValueMode,
    taxiAction: taxiAction || undefined,
    taxiReason: taxiReason || undefined,
  };
}
