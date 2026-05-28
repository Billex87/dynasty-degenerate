import type { ReportData } from "@shared/types";
import type { ManagerIntelPlayer } from "@shared/types";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { PlayerNameWithHeadshot } from "../PlayerNameWithHeadshot";
import { TeamLogoPill } from "../TeamLogoPill";
import { Crown } from "lucide-react";
import {
  buildPlayerModalData,
  formatCompactValue,
  PositionRankPill,
  type PlayerDetailsById,
} from "./shared";
import {
  getPlayerRankForMode,
  getPlayerValueForMode,
} from "@/lib/leagueValueMode";
import { type PlayerModalData } from "../PlayerDetailModal";

export function PlayerInsightTile({
  label,
  player,
  manager,
  managerAvatarUrl,
  playerDetailsById,
  onSelect,
  tone = "neutral",
  extraPill,
  crownedRank,
  leagueValueMode = "dynasty",
}: {
  label: string;
  player: ManagerIntelPlayer | null | undefined;
  manager: string;
  managerAvatarUrl?: string | null;
  playerDetailsById?: PlayerDetailsById;
  onSelect: (player: PlayerModalData) => void;
  tone?: "neutral" | "warn" | "danger";
  extraPill?: string | null;
  crownedRank?: string | null;
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  if (!player) return null;
  const normalizedMode = normalizeLeagueValueMode(leagueValueMode);
  const playerDetails =
    player.playerDetails ||
    (player.player_id ? playerDetailsById?.[player.player_id] : undefined);
  const playerTeam = playerDetails?.team || null;
  const displayedValue = getPlayerValueForMode({
    valueProfile: playerDetails?.valueProfile,
    fallbackValue:
      normalizedMode === "redraft"
        ? (player.seasonValue ?? player.value)
        : player.value,
    mode: normalizedMode,
    context: "overview",
  });
  const displayedRank = getPlayerRankForMode({
    valueProfile: playerDetails?.valueProfile,
    fallbackRank:
      normalizedMode === "redraft"
        ? player.seasonPositionRank || player.currentPositionRank || player.pos
        : player.currentPositionRank || player.seasonPositionRank || player.pos,
    mode: normalizedMode,
    context: "overview",
  });
  const insightKey = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const insightTitle = getPlayerInsightLabelHelp(label);

  return (
    <button
      type="button"
      className={`player-team-tile manager-intel-player ${tone === "warn" ? "manager-intel-player-warn" : ""} ${tone === "danger" ? "manager-intel-player-danger" : ""}`}
      data-insight-label={insightKey}
      style={getTeamTileStyle(playerTeam)}
      title={insightTitle}
      aria-label={`${label}: ${player.name}`}
      onClick={() =>
        onSelect(
          buildPlayerModalData({
            playerId: player.player_id,
            playerName: player.name,
            playerPos: player.pos,
            value: displayedValue,
            playerDetails,
            playerDetailsById,
            currentPositionRank:
              displayedRank ||
              player.currentPositionRank ||
              player.seasonPositionRank,
            manager: player.owner || manager,
            managerAvatarUrl: player.owner ? undefined : managerAvatarUrl,
            valueMode: normalizedMode,
          })
        )
      }
    >
      <div className="manager-intel-player-kicker">{label}</div>
      <div className="manager-intel-player-main">
        <PlayerNameWithHeadshot
          playerId={player.player_id}
          playerName={player.name}
          team={playerTeam}
          position={player.pos}
        />
      </div>
      <div className="manager-intel-player-pills">
        <TeamLogoPill team={playerTeam} />
        <PositionRankPill rank={displayedRank || player.pos} />
        {extraPill && <span>{extraPill}</span>}
        <span>{formatCompactValue(displayedValue)}</span>
      </div>
      {crownedRank && (
        <div className="manager-intel-crown-rank">
          <Crown className="h-3.5 w-3.5" />
          <span>{crownedRank}</span>
        </div>
      )}
    </button>
  );
}

function getPlayerInsightLabelHelp(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("untouchable"))
    return "Core asset. Only move this player for a clear overpay.";
  if (normalized.includes("buy"))
    return "Target profile that fits this roster shape or market window.";
  if (normalized.includes("sell"))
    return "Player whose value, role, or roster fit makes them worth shopping.";
  if (normalized.includes("trade chip"))
    return "Useful value piece to consolidate into a better starter, picks, or cleaner roster fit.";
  if (normalized.includes("insurance"))
    return "Depth piece that protects a fragile starter or position room.";
  if (normalized.includes("droppable"))
    return "First cut candidate when waivers or roster churn matter.";
  if (normalized.includes("weak"))
    return "Projected starter or roster spot opponents can attack.";
  if (normalized.includes("injury"))
    return "Health or availability concern that changes this roster read.";
  if (normalized.includes("bench"))
    return "Best non-starting stash based on value and roster fit.";
  if (normalized.includes("stud"))
    return "Last-season production marker worth keeping in context.";
  return `${label} roster insight.`;
}
