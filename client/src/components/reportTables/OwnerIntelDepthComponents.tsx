import type { ReactNode } from "react";
import { X as XIcon } from "lucide-react";
import type { ManagerIntelPlayer } from "@shared/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  ChampionAvatarFrame,
  ManagerChampionshipPills,
} from "../ManagerChampionships";
import {
  buildPlayerModalData,
  CommandMiniBadge,
  getManagerHeadingClassName,
  IntelligenceMetric,
  formatCompactValue,
  type ManagerAvatars,
  PositionRankPill,
  type PlayerDetailsById,
} from "./shared";
import { PlayerNameWithHeadshot } from "../PlayerNameWithHeadshot";
import { TeamLogoPill } from "../TeamLogoPill";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { type PlayerModalData } from "../PlayerDetailModal";

type OwnerSignalTone =
  | "neutral"
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "good"
  | "contender-gold"
  | "warn"
  | "danger"
  | "future"
  | "elite"
  | "balanced"
  | "weak-contender"
  | "weak-rebuilder"
  | "squeak";
type OwnerSignalTag = {
  label: string;
  tone?: OwnerSignalTone;
};

export function ManagerDepthTile({
  manager,
  avatarUrl,
  badges,
  subtitle,
  subtitleTone = "neutral",
  scoreStrip,
  onClick,
  className = "",
}: {
  manager: string;
  avatarUrl?: string | null;
  badges: OwnerSignalTag[];
  subtitle?: string | null;
  subtitleTone?: OwnerSignalTone;
  scoreStrip?: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  const isViewerTile = className.includes("viewer-owned-highlight");
  const orderedBadges = orderOwnerBadgesForCompactRows(badges);

  return (
    <button
      type="button"
      className={`command-depth-tile ${className}`}
      onClick={onClick}
      aria-label={`Open ${manager} manager details`}
    >
      {avatarUrl && (
        <>
          <img src={avatarUrl} alt="" className="command-depth-tile-wash" />
          <img src={avatarUrl} alt="" className="command-depth-tile-mark" />
        </>
      )}
      <span className="command-depth-tile-scrim" />
      <span className="command-depth-tile-main">
        <ChampionAvatarFrame
          managerName={manager}
          className="command-depth-champion"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={manager}
              className="command-depth-avatar"
            />
          ) : (
            <span className="command-depth-avatar">
              {manager[0]?.toUpperCase() || "?"}
            </span>
          )}
        </ChampionAvatarFrame>
        <span className="command-depth-copy">
          <span className="command-depth-name">{manager}</span>
          {subtitle && (
            <span
              className={`command-depth-subtitle command-depth-subtitle-${subtitleTone}`}
            >
              {subtitle}
            </span>
          )}
        </span>
      </span>
      {scoreStrip && <span className="command-depth-score-row">{scoreStrip}</span>}
      <span className="command-depth-badges">
        {orderedBadges.map(badge => (
          <CommandMiniBadge key={badge.label} tone={badge.tone}>
            {badge.label}
          </CommandMiniBadge>
        ))}
      </span>
      {isViewerTile && (
        <span className="active-owner-badge">
          <span>Your</span>
          <span>Team</span>
        </span>
      )}
    </button>
  );
}

export function orderOwnerBadgesForCompactRows(badges: OwnerSignalTag[]) {
  const remaining = [...badges].sort((a, b) => b.label.length - a.label.length);
  const ordered: OwnerSignalTag[] = [];

  while (remaining.length) {
    const longest = remaining.shift();
    if (longest) ordered.push(longest);

    const shortest = remaining.pop();
    if (shortest) ordered.push(shortest);
  }

  return ordered;
}

export function OwnerQuickModal({
  open,
  onOpenChange,
  title,
  manager,
  avatarUrl,
  metrics,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  manager?: string | null;
  avatarUrl?: string | null;
  metrics: Array<{
    label: string;
    value: ReactNode;
    tone?: "neutral" | "positive" | "negative";
  }>;
  note?: string;
}) {
  if (!manager) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="owner-quick-modal manager-command-dialog max-w-2xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {manager} {title}
          </DialogTitle>
          <DialogDescription>Owner detail summary.</DialogDescription>
        </DialogHeader>
        <div className="manager-command-modal-inner">
          <div className="manager-command-hero owner-quick-hero">
            {avatarUrl && (
              <>
                <img src={avatarUrl} alt="" className="manager-hero-wash" />
                <img
                  src={avatarUrl}
                  alt=""
                  className="manager-hero-watermark"
                />
              </>
            )}
            <div className="manager-hero-scrim" />
            <button
              type="button"
              className="manager-modal-close"
              onClick={() => onOpenChange(false)}
              aria-label={`Close ${manager} details`}
            >
              <XIcon aria-hidden="true" />
            </button>
            <div className="manager-command-title-lockup">
              <ChampionAvatarFrame
                managerName={manager}
                className="manager-command-champion-frame"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={manager}
                    className="manager-command-avatar"
                  />
                ) : (
                  <span className="manager-command-avatar">
                    {manager[0]?.toUpperCase() || "?"}
                  </span>
                )}
              </ChampionAvatarFrame>
              <div className="min-w-0">
                <p>{title}</p>
                <h3 className={getManagerHeadingClassName(manager)}>
                  {manager}
                </h3>
                <ManagerChampionshipPills
                  managerName={manager}
                  className="manager-command-championships"
                />
              </div>
            </div>
            <div className="manager-command-hero-metrics owner-quick-metrics">
              {metrics.slice(0, 6).map(metric => (
                <IntelligenceMetric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  tone={metric.tone}
                />
              ))}
            </div>
          </div>
          {note && (
            <div className="manager-command-body owner-quick-body">
              <div className="manager-command-section manager-command-read">
                <h4>Read</h4>
                <p>{note}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type OwnerIntelDepthRow = {
  manager: string;
  holes: {
    bestQbRank?: string | number | null;
    rb2Rank?: string | number | null;
    wr3Rank?: string | number | null;
    te1Rank?: string | number | null;
    flexDepth?: string | number | null;
  };
  benchBaseline?: Array<{
    key: string;
    label: string;
    player?: ManagerIntelPlayer | null;
    players?: ManagerIntelPlayer[];
    note?: string | null;
    leagueRank?: string | number | null;
  }>;
};

export function OwnerIntelDepthPlayerButton({
  player,
  manager,
  managerAvatars,
  playerDetailsById,
  onSelect,
}: {
  player: ManagerIntelPlayer;
  manager: string;
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  onSelect: (player: PlayerModalData) => void;
}) {
  const playerDetails =
    player.playerDetails ||
    (player.player_id ? playerDetailsById?.[player.player_id] : undefined);
  const team = playerDetails?.team || null;
  const rank =
    player.seasonPositionRank ||
    player.currentPositionRank ||
    player.pos ||
    "-";
  const seasonValue = player.seasonValue || player.value;

  return (
    <button
      type="button"
      className="owner-intel-bench-player player-team-tile"
      style={getTeamTileStyle(team)}
      onClick={() =>
        onSelect(
          buildPlayerModalData({
            playerId: player.player_id,
            playerName: player.name,
            playerPos: player.pos,
            value: seasonValue,
            playerDetails,
            playerDetailsById,
            currentPositionRank: rank,
            valueMode: "redraft",
            manager: player.owner || manager,
            managerAvatarUrl:
              (player.owner && managerAvatars?.[player.owner]) ||
              managerAvatars?.[manager],
          })
        )
      }
    >
      <PlayerNameWithHeadshot
        playerId={player.player_id}
        playerName={player.name}
        team={team}
        position={player.pos}
      />
      <span className="owner-intel-bench-player-meta">
        <TeamLogoPill team={team} />
        <span className="owner-intel-bench-player-value">
          {formatCompactValue(seasonValue)}
        </span>
        <PositionRankPill rank={rank} />
      </span>
    </button>
  );
}

export function BenchBaselineList({
  row,
  playerDetailsById,
  managerAvatars,
  onSelect,
}: {
  row: OwnerIntelDepthRow;
  playerDetailsById?: PlayerDetailsById;
  managerAvatars?: ManagerAvatars;
  onSelect: (player: PlayerModalData) => void;
}) {
  const asRank = (value?: string | number | null) =>
    value == null ? undefined : String(value);

  if (!row.benchBaseline?.length) {
    return (
      <div className="owner-intel-attack-list">
        <span>
          <strong>QB/SF</strong>
          <PositionRankPill rank={asRank(row.holes.bestQbRank)} />
        </span>
        <span>
          <strong>RB2</strong>
          <PositionRankPill rank={asRank(row.holes.rb2Rank)} />
        </span>
        <span>
          <strong>WR3</strong>
          <PositionRankPill rank={asRank(row.holes.wr3Rank)} />
        </span>
        <span>
          <strong>TE1</strong>
          <PositionRankPill rank={asRank(row.holes.te1Rank)} />
        </span>
        <span>
          <strong>Flex depth</strong>
          <em>{row.holes.flexDepth}</em>
        </span>
      </div>
    );
  }

  return (
    <div className="owner-intel-bench-list">
      {row.benchBaseline.map(tile => {
        const player = tile.player;
        const players = tile.players?.length
          ? tile.players
          : player
            ? [player]
            : [];

        return (
          <div
            key={tile.key}
            className="owner-intel-bench-row"
            title={tile.note || ""}
          >
            <div className="owner-intel-bench-rank">
              <strong>{tile.label}</strong>
              <em>{tile.leagueRank ? `#${tile.leagueRank}` : "-"}</em>
            </div>
            {players.length ? (
              <div className="owner-intel-bench-player-stack">
                {players.map(depthPlayer => (
                  <OwnerIntelDepthPlayerButton
                    key={depthPlayer.player_id}
                    player={depthPlayer}
                    manager={row.manager}
                    playerDetailsById={playerDetailsById}
                    managerAvatars={managerAvatars}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ) : (
              <span className="owner-intel-bench-player owner-intel-bench-player-empty">
                No bench option
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TradeableDepthList({
  items,
  row,
  playerDetailsById,
  managerAvatars,
  onSelect,
}: {
  items: Array<{
    position: "QB" | "RB" | "WR" | "TE";
    player: ManagerIntelPlayer;
    note: string;
  }>;
  row: { manager: string };
  playerDetailsById?: PlayerDetailsById;
  managerAvatars?: ManagerAvatars;
  onSelect: (player: PlayerModalData) => void;
}) {
  return (
    <div className="owner-intel-bench-list owner-intel-tradeable-depth-list">
      {items.map(({ position, player, note }) => (
        <div
          key={`${position}-${player.player_id}`}
          className="owner-intel-bench-row"
          title={note}
        >
          <div className="owner-intel-bench-rank">
            <strong>Tradeable {position}</strong>
          </div>
          <OwnerIntelDepthPlayerButton
            player={player}
            manager={row.manager}
            playerDetailsById={playerDetailsById}
            managerAvatars={managerAvatars}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}

export function getHeatPillClass(position: string, grade?: string | null) {
  const normalizedPosition = String(position || "slot")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return `owner-intel-heat-pill owner-intel-heat-position-${normalizedPosition} owner-intel-heat-${String(grade || "empty").toLowerCase()}`;
}
