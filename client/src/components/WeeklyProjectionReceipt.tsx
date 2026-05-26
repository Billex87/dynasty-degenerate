import React from "react";
import type { WeeklyProjectionContext } from "@shared/types";

type WeeklyProjectionReceiptVariant = "card" | "fact" | "pill";

function formatProjectionPoints(value: number): string {
  return `${value.toFixed(1)} pts`;
}

function formatOpponent(weeklyProjection: WeeklyProjectionContext): string | null {
  if (weeklyProjection.homeAway === "bye") return "bye";
  if (!weeklyProjection.opponent) return null;
  if (weeklyProjection.homeAway === "away") return `at ${weeklyProjection.opponent}`;
  if (weeklyProjection.homeAway === "home") return `vs ${weeklyProjection.opponent}`;
  return weeklyProjection.opponent;
}

function formatTepAdjustment(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return `+${value.toFixed(1)} TEP`;
}

export function getWeeklyProjectionReceiptParts(
  weeklyProjection?: WeeklyProjectionContext | null
) {
  if (!weeklyProjection || weeklyProjection.status !== "ready") return null;
  return {
    points: formatProjectionPoints(weeklyProjection.projectedFantasyPoints),
    week: `Week ${weeklyProjection.week}`,
    opponent: formatOpponent(weeklyProjection),
    scoringProfile: weeklyProjection.scoringProfile,
    statSummary: weeklyProjection.statSummary || null,
    tepAdjustment: formatTepAdjustment(weeklyProjection.tightEndPremiumAdjustment),
  };
}

export function WeeklyProjectionReceipt({
  weeklyProjection,
  variant = "card",
  className = "",
  onOpenPlayerDetail,
  playerName,
}: {
  weeklyProjection?: WeeklyProjectionContext | null;
  variant?: WeeklyProjectionReceiptVariant;
  className?: string;
  onOpenPlayerDetail?: () => void;
  playerName?: string | null;
}) {
  const parts = getWeeklyProjectionReceiptParts(weeklyProjection);
  if (!parts) return null;

  const metaItems = [parts.week, parts.opponent, parts.scoringProfile].filter(Boolean);
  const detailItems = [parts.statSummary, parts.tepAdjustment].filter(Boolean);
  const receiptClassName = [
    "weekly-projection-receipt",
    `weekly-projection-receipt-${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const commonProps = {
    className: receiptClassName,
    "data-testid": "weekly-projection-receipt",
  };

  if (variant === "pill") {
    return (
      <span {...commonProps} title={[...metaItems, ...detailItems].join(" · ")}>
        {parts.points} · {parts.week}
        {parts.tepAdjustment ? ` · ${parts.tepAdjustment}` : ""}
      </span>
    );
  }

  const content = (
    <>
      <em>Stored weekly projection</em>
      <strong>{parts.points}</strong>
      <small>{metaItems.join(" · ")}</small>
      {detailItems.length > 0 && <small>{detailItems.join(" · ")}</small>}
    </>
  );

  if (onOpenPlayerDetail) {
    return (
      <button
        {...commonProps}
        type="button"
        data-testid="projection-player-detail-trigger"
        aria-label={`Open stored weekly projection${playerName ? ` for ${playerName}` : ""}`}
        onClick={onOpenPlayerDetail}
      >
        {content}
      </button>
    );
  }

  return <div {...commonProps}>{content}</div>;
}
