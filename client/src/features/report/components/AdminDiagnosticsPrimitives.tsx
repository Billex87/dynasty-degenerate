import { TeamLogoPill } from "@/components/TeamLogoPill";
import type { ScheduleEdgeRow, ScheduleEdgeTone } from "@/lib/scheduleEdgeRows";
import type { WaiverWeeklyEcrWeek } from "@shared/types";

export function AdminAttentionBadge({
  count,
  label,
  tone = "warn",
}: {
  count: number;
  label: string;
  tone?: "warn" | "danger" | "info";
}) {
  if (!Number.isFinite(count) || count <= 0) return null;

  return (
    <span
      className={`admin-attention-badge admin-attention-badge-${tone} inline-pill-shell`}
      aria-label={`${count} ${label}`}
    >
      <strong>{count > 99 ? "99+" : count.toLocaleString()}</strong>
      <em>{label}</em>
    </span>
  );
}

export function ScheduleEdgePlayerCell({ row }: { row: ScheduleEdgeRow }) {
  const isDefenseRow = row.position === "DEF" && row.team;
  const rankBadge = row.seasonRankNumber
    ? `#${row.seasonRankNumber}`
    : row.seasonRank || row.bestRank;

  return (
    <div
      className={[
        "admin-schedule-player-cell",
        isDefenseRow ? "admin-schedule-player-cell-defense" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={row.player.name}
      title={row.player.name}
    >
      {row.team && (
        <TeamLogoPill
          team={row.team}
          className="admin-schedule-player-logo"
        />
      )}
      <div className="admin-schedule-player-copy">
        <span className="admin-schedule-player-rankline">
          <span className="admin-schedule-player-rank-pill">{rankBadge}</span>
          <span className="admin-schedule-player-rank-source">
            {row.seasonRank ? "Current-season rank" : "Source rank"}
          </span>
        </span>
        <strong>{row.player.name}</strong>
        <span>{[row.position, row.team].filter(Boolean).join(" · ")}</span>
      </div>
    </div>
  );
}

export function getScheduleEdgeWeekTone(week: WaiverWeeklyEcrWeek): ScheduleEdgeTone {
  if (week.isBye) return "warn";
  if (week.matchupTier === "easy" || Number(week.matchupStars || 0) >= 4) return "good";
  if (
    week.matchupTier === "hard" ||
    (typeof week.matchupStars === "number" && week.matchupStars <= 2)
  )
    return "danger";
  return "info";
}

export function getScheduleEdgeWeekSite(week: WaiverWeeklyEcrWeek): string {
  if (week.homeAway === "home") return "vs";
  if (week.homeAway === "away") return "at";
  return "";
}

export function getScheduleEdgeWeekStarCount(week: WaiverWeeklyEcrWeek): number | null {
  if (
    typeof week.matchupStars !== "number" ||
    !Number.isFinite(week.matchupStars)
  ) {
    return null;
  }
  return Math.max(1, Math.min(5, Math.round(week.matchupStars)));
}

export function ScheduleEdgeWeekChip({
  rowId,
  week,
}: {
  rowId: string;
  week: WaiverWeeklyEcrWeek;
}) {
  const starCount = getScheduleEdgeWeekStarCount(week);
  const site = getScheduleEdgeWeekSite(week);
  const titleParts = [
    `Week ${week.week}`,
    week.isBye
      ? "Bye"
      : [site, week.opponent].filter(Boolean).join(" ") || "Opponent TBD",
    starCount ? `${starCount} star matchup` : "Unrated matchup",
    typeof week.opponentRank === "number" ? `Opponent rank #${week.opponentRank}` : null,
  ].filter(Boolean);

  return (
    <span
      className={`admin-schedule-week-chip admin-schedule-week-chip-${getScheduleEdgeWeekTone(week)}`}
      title={titleParts.join(" - ")}
    >
      <strong>W{week.week}</strong>
      {week.isBye ? (
        <span className="admin-schedule-week-bye">Bye</span>
      ) : (
        <span className="admin-schedule-week-opponent">
          {site && <span className="admin-schedule-week-site">{site}</span>}
          {week.opponent ? (
            <TeamLogoPill
              team={week.opponent}
              className="admin-schedule-opponent-logo"
            />
          ) : (
            <span className="admin-schedule-week-tbd">TBD</span>
          )}
        </span>
      )}
      {starCount ? (
        <span
          className="admin-schedule-week-stars"
          aria-label={`${starCount} star matchup`}
        >
          {Array.from({ length: starCount }, (_, index) => (
            <span key={`${rowId}-${week.week}-star-${index}`} aria-hidden="true">
              ★
            </span>
          ))}
        </span>
      ) : (
        <span className="admin-schedule-week-unrated">Unrated</span>
      )}
    </span>
  );
}
