import type { ReportData } from "@shared/types";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getPositionRankPillClass } from "@/lib/positionRank";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { ChampionAvatarFrame } from "../ManagerChampionships";
import type { PlayerModalData } from "../PlayerDetailModal";

export type ManagerAvatars = ReportData["managerAvatars"];
export type PlayerDetailsById = ReportData["playerDetailsById"];

export const VALUE_BLEND_HISTORY_START_LABEL = "May 7, 2026";
export const FIRST_FULL_BLEND_WEEK_LABEL = "May 12, 2026 after the 6 PM scrape";

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

export function renderActivityManagerAvatar(
  manager: string | null | undefined,
  managerAvatars?: ManagerAvatars
) {
  if (!manager) {
    return (
      <span
        className="activity-manager-avatar activity-manager-avatar-empty"
        aria-label="Available player"
        title="Available"
      >
        FA
      </span>
    );
  }

  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || "?";

  return (
    <span
      className="activity-manager-avatar"
      aria-label={`Rostered by ${manager}`}
      title={manager}
    >
      <ChampionAvatarFrame managerName={manager} showAccolades={false}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span aria-hidden="true" className="activity-manager-avatar-fallback">
            {initial}
          </span>
        )}
      </ChampionAvatarFrame>
    </span>
  );
}

export function ValueTrendIcon({
  value,
  className = "h-3.5 w-3.5",
}: {
  value?: number | null;
  className?: string;
}) {
  if (!value) return null;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return <Icon className={className} aria-hidden="true" />;
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
