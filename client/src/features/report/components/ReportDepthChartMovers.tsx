import type { CSSProperties } from "react";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import type { DepthChartMover, ReportData } from "@shared/types";
import { EmptyState, PlayerIdentityRow } from "@/components/reportPrimitives";
import { TeamLogoPill } from "@/components/TeamLogoPill";
import { PositionRankPill } from "@/components/reportTables/shared";
import { cn } from "@/lib/utils";

function roleLabel(slot: string | null, rank: number | null): string {
  if (slot) return slot;
  if (rank) return `Rank ${rank}`;
  return "Unlisted";
}

function movementCopy(mover: DepthChartMover): string {
  if (mover.kind === "newly-listed") return "New starter listing";
  if (mover.kind === "removed") return "Removed from chart";
  if (mover.kind === "promoted-to-starter") return "Promoted to starter";
  if (mover.kind === "demoted-from-starter") return "Demoted from starter";
  return mover.direction === "up" ? "Depth rank improved" : "Depth rank declined";
}

function formatSnapshotWindow(data?: ReportData["depthChartMovers"]): string {
  if (!data?.currentSnapshotKey || !data.baselineSnapshotKey) return "Waiting for two stored depth-chart snapshots.";
  return `${data.baselineSnapshotKey} to ${data.currentSnapshotKey}`;
}

function DepthChartMoverCard({
  mover,
  playerDetailsById,
}: {
  mover: DepthChartMover;
  playerDetailsById?: ReportData["playerDetailsById"];
}) {
  const details = mover.playerId ? playerDetailsById?.[mover.playerId] : undefined;
  const isUp = mover.direction === "up";
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <article className={cn("depth-chart-mover-card", isUp ? "depth-chart-mover-card-up" : "depth-chart-mover-card-down")}>
      <div className="depth-chart-mover-card-top">
        <span className="depth-chart-mover-signal">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {movementCopy(mover)}
        </span>
        <strong>{mover.confidence}%</strong>
      </div>
      <PlayerIdentityRow
        className="depth-chart-mover-player"
        playerId={mover.playerId}
        playerName={mover.playerName}
        team={details?.team || mover.team}
        position={details?.position || mover.position}
        hideMeta
      />
      <div className="depth-chart-mover-role-line" aria-label={`${mover.playerName} depth chart movement`}>
        <span>{roleLabel(mover.previousSlot, mover.previousRank)}</span>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        <strong>{roleLabel(mover.currentSlot, mover.currentRank)}</strong>
      </div>
      <div className="depth-chart-mover-meta">
        <TeamLogoPill team={details?.team || mover.team} />
        <PositionRankPill rank={mover.currentPositionRank || details?.valueProfile?.dynastyPositionRank || mover.position} />
        {mover.owner && <span className="depth-chart-mover-owner">{mover.owner}</span>}
      </div>
    </article>
  );
}

function DepthChartMoverLane({
  title,
  tone,
  movers,
  playerDetailsById,
}: {
  title: string;
  tone: "up" | "down";
  movers: DepthChartMover[];
  playerDetailsById?: ReportData["playerDetailsById"];
}) {
  return (
    <section className={cn("depth-chart-mover-lane", `depth-chart-mover-lane-${tone}`)}>
      <div className="depth-chart-mover-lane-header">
        <h4>{title}</h4>
        <span>{movers.length}/6</span>
      </div>
      {movers.length ? (
        <div className="depth-chart-mover-list">
          {movers.map((mover) => (
            <DepthChartMoverCard
              key={`${mover.direction}-${mover.playerId || mover.playerName}-${mover.previousRank}-${mover.currentRank}`}
              mover={mover}
              playerDetailsById={playerDetailsById}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          className="depth-chart-mover-empty"
          title={tone === "up" ? "No source-backed promotions in this seven-day window." : "No source-backed demotions in this seven-day window."}
        />
      )}
    </section>
  );
}

export function ReportDepthChartMovers({
  data,
  playerDetailsById,
}: {
  data?: ReportData["depthChartMovers"];
  playerDetailsById?: ReportData["playerDetailsById"];
}) {
  const upCount = data?.up?.length || 0;
  const downCount = data?.down?.length || 0;
  const total = upCount + downCount;
  const upShare = total ? Math.round((upCount / total) * 100) : 50;
  const graphStyle = {
    "--depth-chart-up-share": `${upShare}%`,
  } as CSSProperties;

  return (
    <div className="depth-chart-movers-panel">
      <div className="depth-chart-movers-summary">
        <div>
          <span>7-day depth chart window</span>
          <strong>{formatSnapshotWindow(data)}</strong>
        </div>
        <div className="depth-chart-movers-graph" style={graphStyle} aria-label={`${upCount} players moved up and ${downCount} moved down`}>
          <span className="depth-chart-movers-graph-up" />
          <span className="depth-chart-movers-graph-down" />
        </div>
        <div className="depth-chart-movers-counts">
          <span><strong>{upCount}</strong> up</span>
          <span><strong>{downCount}</strong> down</span>
        </div>
      </div>
      <div className="depth-chart-mover-lanes">
        <DepthChartMoverLane
          title="Moved Up"
          tone="up"
          movers={data?.up || []}
          playerDetailsById={playerDetailsById}
        />
        <DepthChartMoverLane
          title="Moved Down"
          tone="down"
          movers={data?.down || []}
          playerDetailsById={playerDetailsById}
        />
      </div>
    </div>
  );
}
