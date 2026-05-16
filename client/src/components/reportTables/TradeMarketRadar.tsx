import React, { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReportData } from "@shared/types";
import { ManagerNameWithAvatar } from "../ManagerNameWithAvatar";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { TeamLogoPill } from "../TeamLogoPill";
import { PlayerIdentityRow } from "../reportPrimitives";
import { getPlayerValueForMode, normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { getBalancedGridStyle } from "@/lib/balancedGrid";
import { viewerOwnedHighlightClass } from "@/lib/viewerHighlight";
import {
  buildPlayerModalData,
  formatCompactValue,
  PositionRankPill,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";

function renderManagerName(manager: string, managerAvatars?: ManagerAvatars) {
  return (
    <ManagerNameWithAvatar
      avatarUrl={managerAvatars?.[manager]}
      managerName={manager}
    />
  );
}

function ValueTrendIcon({
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

export default function TradeMarketRadar({
  risers,
  fallers,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  viewerManager,
  leagueValueMode: leagueValueModeInput = "dynasty",
}: {
  risers: ReportData["weeklyRisers"];
  fallers: ReportData["weeklyFallers"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const leagueValueMode = normalizeLeagueValueMode(leagueValueModeInput);
  const sellHigh = risers.filter(player => player.val_now >= 2500).slice(0, 5);
  const buyLow = fallers.filter(player => player.val_now >= 1800).slice(0, 5);
  const rows = [
    ...sellHigh.map(player => ({
      label: leagueValueMode === "redraft" ? "Starter Leverage" : "Sell High",
      tone: "positive" as const,
      player,
    })),
    ...buyLow.map(player => ({
      label: leagueValueMode === "redraft" ? "Usage Discount" : "Buy Low",
      tone: "negative" as const,
      player,
    })),
  ].slice(0, 10);
  if (rows.length === 0) return null;

  return (
    <div
      className="player-tile-grid trade-market-grid balanced-tile-grid"
      style={getBalancedGridStyle(rows.length)}
    >
      {rows.map(({ label, tone, player }) => (
        <button
          key={`${label}-${player.player_id || player.name}`}
          type="button"
          className={`player-team-tile trade-market-card ${tone === "positive" ? "trade-market-card-sell" : "trade-market-card-buy"} ${viewerOwnedHighlightClass(player.owner, viewerManager)}`}
          style={getTeamTileStyle(player.playerDetails?.team)}
          onClick={() =>
            setSelectedPlayer(
              buildPlayerModalData({
                playerId: player.player_id,
                playerName: player.name,
                playerPos: player.pos,
                value: getPlayerValueForMode({
                  valueProfile: player.playerDetails?.valueProfile,
                  fallbackValue: player.val_now,
                  mode: leagueValueMode,
                  context: "trade",
                }),
                valueGain: player.diff,
                playerDetails: player.playerDetails,
                playerDetailsById,
                currentPositionRank: player.currentPositionRank,
                valueMode: leagueValueMode,
                manager: player.owner,
                managerAvatarUrl: managerAvatars?.[player.owner],
                valueChangeNote: "Change from last week to this week.",
              })
            )
          }
        >
          <div className="trade-market-top">
            <span className="trade-market-signal">{label}</span>
            <span
              className={`trade-market-change ${tone === "positive" ? "text-emerald-300" : "text-rose-300"}`}
            >
              {player.diff > 0 ? "+" : ""}
              {player.diff.toLocaleString()}
              <ValueTrendIcon value={player.diff} />
            </span>
          </div>
          <div className="trade-market-main">
            <PlayerIdentityRow
              className="trade-market-player"
              playerId={player.player_id}
              playerName={player.name}
              team={player.playerDetails?.team}
              position={player.pos}
              hideMeta
            />
            <div className="trade-market-manager">
              {renderManagerName(player.owner, managerAvatars)}
            </div>
          </div>
          <div className="trade-market-pills">
            <TeamLogoPill team={player.playerDetails?.team} />
            <PositionRankPill rank={player.currentPositionRank || player.pos} />
            <span>
              {formatCompactValue(
                getPlayerValueForMode({
                  valueProfile: player.playerDetails?.valueProfile,
                  fallbackValue: player.val_now,
                  mode: leagueValueMode,
                  context: "trade",
                })
              )}
            </span>
          </div>
        </button>
      ))}
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={playerDetailsById}
      />
    </div>
  );
}
